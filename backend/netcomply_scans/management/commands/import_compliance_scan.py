from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from backend.netcomply_scans.services import import_scan_file


class Command(BaseCommand):
    help = "Import the latest compliance API JSON payload into the local scan tables."

    def add_arguments(self, parser):
        parser.add_argument("input_json", type=Path)
        parser.add_argument("--tmp-dir", type=Path, default=Path("tmp/hcc-scans"))
        parser.add_argument("--source", default="external-api")

    def handle(self, *args, **options):
        input_path: Path = options["input_json"]
        if not input_path.exists():
            raise CommandError(f"{input_path} does not exist")

        try:
            result = import_scan_file(input_path, source=options["source"])
        except (FileNotFoundError, ValueError) as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS(f"Imported scan batch {result['batchId']} from {result['payloadPath']}"))
