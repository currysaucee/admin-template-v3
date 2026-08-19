import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from backend.netcomply_scans.services import coerce_scan_payload, import_scan_payload, write_latest_payload


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

        try:
            payload = coerce_scan_payload(json.loads(input_path.read_text(encoding="utf-8-sig")))
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        latest_path = write_latest_payload(payload, options["tmp_dir"])
        batch = import_scan_payload(payload, latest_path, options["source"])
        self.stdout.write(self.style.SUCCESS(f"Imported scan batch {batch.id} from {latest_path}"))
