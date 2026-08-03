#!/usr/bin/env python3
"""Preload NetComply policy settings into the configured scan database.

This is intentionally a skeleton: add policy dictionaries to POLICY_SETTINGS
locally when you need seed data. No policy content is committed here.
"""

from __future__ import annotations

import argparse
import os
from typing import Any

import django


POLICY_SETTINGS: list[dict[str, Any]] = []


def configure_django(settings_module: str) -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)
    django.setup()


def load_policy_settings(db_alias: str, clear_existing: bool) -> int:
    from django.conf import settings

    try:
        from backend.netcomply_scans.models import PolicySettingRecord
    except ImportError:
        from backend.hcc.models import PolicySettingRecord  # type: ignore

    resolved_alias = db_alias or getattr(settings, "NETCOMPLY_SCAN_DB_ALIAS", "default")
    queryset = PolicySettingRecord.objects.using(resolved_alias)

    if clear_existing:
        queryset.all().delete()

    if not POLICY_SETTINGS:
        return 0

    queryset.bulk_create([PolicySettingRecord(payload=payload) for payload in POLICY_SETTINGS])
    return len(POLICY_SETTINGS)


def main() -> None:
    parser = argparse.ArgumentParser(description="Preload policy settings into the NetComply scan database.")
    parser.add_argument("--settings", default=os.environ.get("DJANGO_SETTINGS_MODULE", "backend.settings"), help="Django settings module.")
    parser.add_argument("--database", default="", help="Django database alias. Defaults to settings.NETCOMPLY_SCAN_DB_ALIAS, then default.")
    parser.add_argument("--keep-existing", action="store_true", help="Append rows instead of clearing existing policy settings first.")
    args = parser.parse_args()

    configure_django(args.settings)
    inserted = load_policy_settings(args.database, clear_existing=not args.keep_existing)
    print(f"Inserted {inserted} policy setting(s).")


if __name__ == "__main__":
    main()
