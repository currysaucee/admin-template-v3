#!/usr/bin/env python3
"""Write the latest compliance JSON payload to tmp and import it into SQLite.

The input must be a top-level JSON array of device scan objects.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


FALSE_STRINGS = {"false", "non-compliant", "non compliant", "failed", "fail", "no", "0"}
TRUE_STRINGS = {"true", "compliant", "passed", "pass", "yes", "1"}


def pick(obj: dict[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        if key in obj and obj[key] not in (None, ""):
            return obj[key]
    lowered = {str(key).lower(): value for key, value in obj.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, ""):
            return value
    return default


def normalize_policy_id(value: Any) -> str:
    text = str(value).strip()
    match = re.search(r"([A-Za-z]{1,4})[-_\s]?(\d{1,4})", text)
    if match:
        return f"{match.group(1).upper()}{int(match.group(2)):03d}"
    return text.upper()


def is_non_compliant(device: dict[str, Any]) -> bool:
    value = pick(device, "complyStatus", "complianceStatus", "isCompliant", "compliant", "status", default=None)
    if isinstance(value, bool):
        return value is False
    if isinstance(value, (int, float)):
        return value == 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in FALSE_STRINGS:
            return True
        if normalized in TRUE_STRINGS:
            return False
    return False


def normalize_keyed_payload(raw_value: Any) -> list[dict[str, Any]]:
    if isinstance(raw_value, dict):
        iterable = [{key: value} for key, value in raw_value.items()]
    elif isinstance(raw_value, list):
        iterable = raw_value
    else:
        iterable = []

    rows: list[dict[str, Any]] = []
    for item in iterable:
        if isinstance(item, dict) and len(item) == 1:
            policy_id, payload = next(iter(item.items()))
            rows.append({"policy_id": normalize_policy_id(policy_id), "payload": "" if payload is None else str(payload), "raw": item})
        elif isinstance(item, dict):
            policy_id = normalize_policy_id(pick(item, "id", "policyId", "policyNumber", "settingNumber", "identifier"))
            payload = pick(item, "payload", "expectedValue", "agreedSetting", "settingPayload", "expected", "rule", "description", "actualConfig", "config", default="")
            if policy_id:
                rows.append({"policy_id": policy_id, "payload": "" if payload is None else str(payload), "raw": item})
    return rows


def write_latest_payload(payload: list[dict[str, Any]], tmp_dir: Path, consumed_at: datetime) -> Path:
    tmp_dir.mkdir(parents=True, exist_ok=True)
    for old_file in tmp_dir.glob("latest_compliance_scan_*.json"):
        old_file.unlink()

    output_path = tmp_dir / f"latest_compliance_scan_{consumed_at.strftime('%Y%m%dT%H%M%S')}.json"
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    (tmp_dir / "latest_consumed.json").write_text(
        json.dumps({"consumedAt": consumed_at.isoformat(), "payloadPath": str(output_path)}, indent=2),
        encoding="utf-8",
    )
    return output_path


def ensure_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS netcomply_compliance_scan_batch (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source VARCHAR(120) NOT NULL DEFAULT 'external-api',
          consumed_at DATETIME NOT NULL,
          raw_payload_path VARCHAR(500) NOT NULL,
          device_count INTEGER UNSIGNED NOT NULL DEFAULT 0,
          non_compliant_device_count INTEGER UNSIGNED NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL
        );
        CREATE TABLE IF NOT EXISTS netcomply_compliance_scan_device (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id BIGINT NOT NULL,
          hostname VARCHAR(255) NOT NULL,
          hardware_type VARCHAR(120) NOT NULL,
          management_ip VARCHAR(64) NOT NULL,
          site VARCHAR(120) NOT NULL,
          role VARCHAR(120) NOT NULL DEFAULT '',
          comply_status BOOLEAN NOT NULL DEFAULT 0,
          raw_payload JSON NOT NULL,
          created_at DATETIME NOT NULL,
          FOREIGN KEY(batch_id) REFERENCES netcomply_compliance_scan_batch(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS netcomply_compliance_scan_finding (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id BIGINT NOT NULL,
          policy_id VARCHAR(80) NOT NULL,
          finding_payload TEXT NOT NULL,
          current_value TEXT NOT NULL DEFAULT '',
          raw_payload JSON NOT NULL,
          created_at DATETIME NOT NULL,
          FOREIGN KEY(device_id) REFERENCES netcomply_compliance_scan_device(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS netcomply_compliance_scan_actual_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id BIGINT NOT NULL,
          policy_id VARCHAR(80) NOT NULL,
          config_payload TEXT NOT NULL,
          raw_payload JSON NOT NULL,
          created_at DATETIME NOT NULL,
          FOREIGN KEY(device_id) REFERENCES netcomply_compliance_scan_device(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS netcomply_scan_device_batch_hostname ON netcomply_compliance_scan_device(batch_id, hostname);
        CREATE INDEX IF NOT EXISTS netcomply_scan_finding_policy ON netcomply_compliance_scan_finding(policy_id);
        CREATE INDEX IF NOT EXISTS netcomply_scan_actual_config_policy ON netcomply_compliance_scan_actual_config(policy_id);
        CREATE TABLE IF NOT EXISTS netcomply_policy_setting (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payload JSON NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS netcomply_remediation_template (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_key VARCHAR(180) NOT NULL UNIQUE,
          payload JSON NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS netcomply_template_request (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id VARCHAR(80) NOT NULL UNIQUE,
          payload JSON NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS netcomply_remediation_ticket (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id VARCHAR(80) NOT NULL UNIQUE,
          payload JSON NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )


def import_payload(connection: sqlite3.Connection, payload: list[dict[str, Any]], raw_payload_path: Path, source: str, consumed_at: datetime) -> tuple[int, int]:
    now = consumed_at.isoformat()
    non_compliant = [item for item in payload if isinstance(item, dict) and is_non_compliant(item)]
    cursor = connection.cursor()
    cursor.execute(
        """
        INSERT INTO netcomply_compliance_scan_batch
          (source, consumed_at, raw_payload_path, device_count, non_compliant_device_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (source, now, str(raw_payload_path), len(payload), len(non_compliant), now),
    )
    batch_id = cursor.lastrowid
    imported = 0

    for raw_device in non_compliant:
        hostname = str(pick(raw_device, "hostname", "hostName", "device", "deviceName", "name")).strip()
        hardware_type = str(pick(raw_device, "hardwareType", "deviceType", "type", "platform")).strip()
        management_ip = str(pick(raw_device, "managementIp", "managementIP", "mgmtIp", "mgmtIP", "ipAddress", "ip")).strip()
        site = str(pick(raw_device, "site", "location", "siteCode")).strip()
        if not (hostname and hardware_type and management_ip and site):
            continue

        cursor.execute(
            """
            INSERT INTO netcomply_compliance_scan_device
              (batch_id, hostname, hardware_type, management_ip, site, role, comply_status, raw_payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (batch_id, hostname, hardware_type, management_ip, site, str(pick(raw_device, "role", default="")), 0, json.dumps(raw_device, ensure_ascii=False), now),
        )
        device_id = cursor.lastrowid
        imported += 1

        actual_configs = {row["policy_id"]: row["payload"] for row in normalize_keyed_payload(pick(raw_device, "actualConfig", "actualConfigs", "configSnapshot", "runningConfig", "rawConfig", "configuration", default=[]))}
        for finding in normalize_keyed_payload(pick(raw_device, "findings", "policies", "violations", "exceptions", default=[])):
            cursor.execute(
                """
                INSERT INTO netcomply_compliance_scan_finding
                  (device_id, policy_id, finding_payload, current_value, raw_payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (device_id, finding["policy_id"], finding["payload"], actual_configs.get(finding["policy_id"], ""), json.dumps(finding["raw"], ensure_ascii=False), now),
            )

        for config in normalize_keyed_payload(pick(raw_device, "actualConfig", "actualConfigs", "configSnapshot", "runningConfig", "rawConfig", "configuration", default=[])):
            cursor.execute(
                """
                INSERT INTO netcomply_compliance_scan_actual_config
                  (device_id, policy_id, config_payload, raw_payload, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (device_id, config["policy_id"], config["payload"], json.dumps(config["raw"], ensure_ascii=False), now),
            )

    connection.commit()
    return imported, len(payload) - imported


def main() -> None:
    parser = argparse.ArgumentParser(description="Consume compliance scan JSON into tmp/latest payload and local SQLite.")
    parser.add_argument("input_json", type=Path, help="Top-level JSON array from the scanner/API.")
    parser.add_argument("--tmp-dir", type=Path, default=Path("tmp/netcomply-scans"))
    parser.add_argument("--db", type=Path, default=Path("tmp/netcomply-scans/netcomply_scans.sqlite3"))
    parser.add_argument("--source", default="external-api")
    args = parser.parse_args()

    payload = json.loads(args.input_json.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list):
        raise SystemExit("Expected top-level JSON array of device scan objects.")

    consumed_at = datetime.now(timezone.utc)
    latest_payload_path = write_latest_payload(payload, args.tmp_dir, consumed_at)
    args.db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(args.db) as connection:
        ensure_schema(connection)
        imported, skipped = import_payload(connection, payload, latest_payload_path, args.source, consumed_at)

    print(f"Consumed payload: {latest_payload_path}")
    print(f"SQLite DB: {args.db}")
    print(f"Imported {imported} device(s); skipped {skipped}.")


if __name__ == "__main__":
    main()
