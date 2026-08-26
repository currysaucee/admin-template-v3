from django.core.management.base import BaseCommand

from backend.netcomply_scans.services import cleanup_duplicate_scan_policy_rows


class Command(BaseCommand):
    help = "Remove duplicate compliance scan finding/config rows under the same scan device."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Delete duplicates. Without this flag, only reports what would be removed.")

    def handle(self, *args, **options):
        result = cleanup_duplicate_scan_policy_rows(dry_run=not options["apply"])
        mode = "applied" if options["apply"] else "dry run"
        self.stdout.write(self.style.SUCCESS(f"Scan duplicate cleanup {mode}: {result}"))
