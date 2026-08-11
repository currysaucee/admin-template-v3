from __future__ import annotations

from django.core.management.base import BaseCommand

from backend.netcomply_scans.services import run_daily_scan_import


class Command(BaseCommand):
    help = "Fetch the latest compliance scan from the configured API and import it into the scan tables."

    def handle(self, *args, **options):
        result = run_daily_scan_import()
        self.stdout.write(
            self.style.SUCCESS(
                "Imported scan batch {batchId}: {nonCompliantDeviceCount}/{deviceCount} non-compliant devices from {source}".format(**result)
            )
        )
