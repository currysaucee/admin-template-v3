import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from backend.netcomply_scans.services import import_scan_payload, write_latest_payload


class Command(BaseCommand):
    help = "Import the latest compliance API JSON payload into the local scan tables."

    def add_arguments(self, parser):
        parser.add_argument("input_json", type=Path)
        parser.add_argument("--tmp-dir", type=Path, default=Path("tmp/netcomply-scans"))
        parser.add_argument("--source", default="external-api")

    def handle(self, *args, **options):
        input_path: Path = options["input_json"]
        if not input_path.exists():
            raise CommandError(f"{input_path} does not exist")

        payload = json.loads(input_path.read_text(encoding="utf-8-sig"))
        if not isinstance(payload, list):
            raise CommandError("Expected top-level JSON array of device scan objects")

        latest_path = write_latest_payload(payload, options["tmp_dir"])
        batch = import_scan_payload(payload, latest_path, options["source"])
        self.stdout.write(self.style.SUCCESS(f"Imported scan batch {batch.id} from {latest_path}"))
