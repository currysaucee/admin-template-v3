from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand

from ...models import PolicySettingRecord


# Add local seed rows here when needed. Keep committed version empty.
POLICY_SETTINGS: list[dict[str, Any]] = []


class Command(BaseCommand):
    help = "Preload policy settings into the NetComply scan database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default=getattr(settings, "NETCOMPLY_SCAN_DB_ALIAS", "default"),
            help="Database alias to write to.",
        )
        parser.add_argument(
            "--keep-existing",
            action="store_true",
            help="Append rows instead of clearing existing policy settings first.",
        )

    def handle(self, *args, **options):
        db_alias = options["database"]
        queryset = PolicySettingRecord.objects.using(db_alias)

        if not options["keep_existing"]:
            queryset.all().delete()

        if POLICY_SETTINGS:
            queryset.bulk_create([PolicySettingRecord(payload=row) for row in POLICY_SETTINGS])

        self.stdout.write(
            self.style.SUCCESS(f"Inserted {len(POLICY_SETTINGS)} policy setting(s) into {db_alias}.")
        )
