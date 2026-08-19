from __future__ import annotations

from celery import shared_task

from .services import default_mock_scan_payload_path, import_scan_file, run_daily_scan_import


@shared_task(name="netcomply.run_daily_scan_import")
def run_daily_scan_import_task() -> dict:
    return run_daily_scan_import()


@shared_task(name="netcomply.import_scan_file")
def import_scan_file_task(payload_path: str | None = None) -> dict:
    return import_scan_file(payload_path or default_mock_scan_payload_path(), source="scheduled-file-import")
