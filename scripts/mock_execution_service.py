from __future__ import annotations

import json
import os
import shlex
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any


HOST = os.environ.get("HCC_MOCK_EXECUTOR_HOST", "127.0.0.1")
PORT = int(os.environ.get("HCC_MOCK_EXECUTOR_PORT", "9100"))
ALLOW_LOCAL_COMMANDS = os.environ.get("HCC_MOCK_EXECUTOR_ALLOW_LOCAL_COMMANDS", "").lower() in {"1", "true", "yes"}
COMMAND_TIMEOUT_SECONDS = int(os.environ.get("HCC_MOCK_EXECUTOR_TIMEOUT", "15"))


def extract_command_rows(payload: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for device in payload.get("devices", []):
        hostname = str(device.get("hostname") or "")
        management_ip = str(device.get("managementIp") or "")
        for finding in device.get("findings", []):
            policy_id = str(finding.get("policyId") or "")
            if finding.get("status") == "Skipped":
                continue
            for command in finding.get("implementationCommands", []):
                command_text = str(command).strip()
                if command_text:
                    rows.append({
                        "hostname": hostname,
                        "managementIp": management_ip,
                        "policyId": policy_id,
                        "command": command_text,
                    })
    return rows


def run_command(command: str) -> dict[str, Any]:
    if not ALLOW_LOCAL_COMMANDS:
        return {
            "status": "Simulated",
            "returnCode": 0,
            "stdout": f"Simulation only. Would run: {command}",
            "stderr": "",
        }

    try:
        completed = subprocess.run(
            shlex.split(command, posix=False),
            capture_output=True,
            text=True,
            timeout=COMMAND_TIMEOUT_SECONDS,
            shell=False,
        )
        return {
            "status": "Executed" if completed.returncode == 0 else "Failed",
            "returnCode": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
        }
    except Exception as exc:
        return {
            "status": "Failed",
            "returnCode": -1,
            "stdout": "",
            "stderr": str(exc),
        }


class MockExecutionHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.rstrip("/") != "/health":
            self._send_json(404, {"detail": "Use POST /execute or GET /health."})
            return
        self._send_json(200, {
            "status": "ok",
            "mode": "execute-local" if ALLOW_LOCAL_COMMANDS else "simulate",
            "port": PORT,
        })

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/execute":
            self._send_json(404, {"detail": "Use POST /execute."})
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as exc:
            self._send_json(400, {"detail": f"Invalid JSON payload: {exc}"})
            return

        rows = extract_command_rows(payload)
        results = [{**row, **run_command(row["command"])} for row in rows]
        self._send_json(200, {
            "mode": "execute-local" if ALLOW_LOCAL_COMMANDS else "simulate",
            "ticketId": payload.get("ticketId"),
            "commandCount": len(rows),
            "results": results,
        })

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), MockExecutionHandler)
    print(f"Mock execution service listening on http://{HOST}:{PORT}")
    print("POST execution plans to /execute")
    print(f"Mode: {'execute-local' if ALLOW_LOCAL_COMMANDS else 'simulate'}")
    server.serve_forever()
