from __future__ import annotations

from celery import shared_task

from .services import run_daily_scan_import


@shared_task(name="netcomply.run_daily_scan_import")
def run_daily_scan_import_task() -> dict:
    return run_daily_scan_import()
