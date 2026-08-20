from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, time as day_time
from pathlib import Path
from typing import Any


# Edit these values directly for local/dev installs.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DJANGO_SETTINGS_MODULE = "backend.settings"
WORKER_ID = "local-worker-01"
POLL_INTERVAL_SECONDS = 30
HEARTBEAT_INTERVAL_SECONDS = 60
EXECUTION_WINDOW_START = day_time(0, 0)
EXECUTION_WINDOW_END = day_time(6, 0)
PROCESS_OUTSIDE_WINDOW = False
HEARTBEAT_DIR = PROJECT_ROOT / "tmp" / "netcomply-deployment-workers"


def configure_django() -> None:
    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", DJANGO_SETTINGS_MODULE)

    import django

    django.setup()


def now_iso() -> str:
    return datetime.now().astimezone().isoformat()


def in_execution_window() -> bool:
    if PROCESS_OUTSIDE_WINDOW:
        return True
    current = datetime.now().time()
    if EXECUTION_WINDOW_START <= EXECUTION_WINDOW_END:
        return EXECUTION_WINDOW_START <= current < EXECUTION_WINDOW_END
    return current >= EXECUTION_WINDOW_START or current < EXECUTION_WINDOW_END


def write_heartbeat(status: str, detail: str, processed_count: int, last_queue_id: str = "") -> None:
    HEARTBEAT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "workerId": WORKER_ID,
        "status": status,
        "detail": detail,
        "processedCount": processed_count,
        "lastQueueId": last_queue_id,
        "lastSeenAt": now_iso(),
        "executionWindow": {
            "start": EXECUTION_WINDOW_START.strftime("%H:%M"),
            "end": EXECUTION_WINDOW_END.strftime("%H:%M"),
            "processOutsideWindow": PROCESS_OUTSIDE_WINDOW,
        },
    }
    (HEARTBEAT_DIR / f"{WORKER_ID}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def process_once() -> dict[str, Any]:
    try:
        from hcc.services import process_next_deployment_queue_item
    except ImportError:
        from backend.netcomply_scans.services import process_next_deployment_queue_item

    return process_next_deployment_queue_item(worker_id=WORKER_ID)


def main() -> None:
    configure_django()
    processed_count = 0
    last_heartbeat_at = 0.0
    last_queue_id = ""
    print(f"Deployment queue consumer started as {WORKER_ID}")
    print(f"Execution window: {EXECUTION_WINDOW_START.strftime('%H:%M')} to {EXECUTION_WINDOW_END.strftime('%H:%M')}")
    print(f"Heartbeat file: {HEARTBEAT_DIR / f'{WORKER_ID}.json'}")

    while True:
        try:
            if not in_execution_window():
                status = "Idle"
                detail = "Outside execution window."
            else:
                result = process_once()
                queue_item = result.get("queueItem") or {}
                if result.get("claimed"):
                    processed_count += 1
                    last_queue_id = str(queue_item.get("queueId") or "")
                    status = "Processing"
                    detail = f"Processed {last_queue_id or 'one queue item'}."
                else:
                    status = "Alive"
                    detail = "No queued deployment item is available."

            current_time = time.time()
            if current_time - last_heartbeat_at >= HEARTBEAT_INTERVAL_SECONDS:
                write_heartbeat(status, detail, processed_count, last_queue_id=last_queue_id)
                last_heartbeat_at = current_time
            print(f"{now_iso()} {status}: {detail}")
        except Exception as exc:
            write_heartbeat("Error", str(exc), processed_count, last_queue_id=last_queue_id)
            print(f"{now_iso()} Error: {exc}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
