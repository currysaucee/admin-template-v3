from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import django


# Copy/paste test script for the backend-to-backend daily scan import flow.
# Fill these in for your local scanner/API endpoint.
SCAN_API_URL = "https://scanner.example/api/latest-scan"
API_KEY = "replace-me"
API_KEY_HEADER = "x-api-key"

# Change this if your Django project settings module is not backend.settings.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from backend.netcomply_scans.services import import_scan_payload, write_latest_payload  # noqa: E402


headers = {
    "Accept": "application/json",
    API_KEY_HEADER: API_KEY,
}

request = Request(SCAN_API_URL, headers=headers, method="GET")

try:
    with urlopen(request, timeout=60) as response:
        status_code = response.status
        response_body = response.read().decode("utf-8-sig")
except HTTPError as exc:
    raise SystemExit(f"Scanner API returned HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}") from exc
except URLError as exc:
    raise SystemExit(f"Unable to reach scanner API: {exc.reason}") from exc

if status_code != 200:
    raise SystemExit(f"Scanner API returned HTTP {status_code}; import skipped")

payload = json.loads(response_body)
if isinstance(payload, dict) and isinstance(payload.get("devices"), list):
    payload = payload["devices"]
if not isinstance(payload, list):
    raise SystemExit("Expected scanner API response to be a JSON array, or an object with a devices array")

tmp_dir = Path("tmp/netcomply-scans")
latest_path = write_latest_payload(payload, tmp_dir)
batch = import_scan_payload(payload, latest_path, source="manual-backend-api-test")

print(f"Saved scanner response to: {latest_path}")
print(f"Imported scan batch: {batch.id}")
print(f"Devices received: {batch.device_count}")
print(f"Non-compliant devices imported: {batch.non_compliant_device_count}")
