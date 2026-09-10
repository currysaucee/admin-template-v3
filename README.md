# Admin Template UI

React + TypeScript + Vite + PrimeReact prototype for an empty administrative workflow UI.

## Run locally

```bash
npm install
npm start
```

Then open:

```text
http://127.0.0.1:5173/
```

You can also run:

```bash
npm run dev
npm run build
```

## Daily scan import

Policy `0000` in a device's `findings` marks that device as unreachable. The importer keeps the device for visibility, ignores every other finding and actual-config row for that device, and exposes it to the UI with compliance status `Device Unreachable` instead of `Non-Compliant`.

Policy onboarding is append-only. Reusing a recognized policy number requires a different expected configuration and explicit variant acknowledgement; the backend stores a new `-V2`, `-V3`, and later record while preserving earlier policy and ticket payloads for audit history.

The backend exposes one shared scan import flow:

- Ad-hoc API trigger: `POST /api/HCCFix/scan/import/`
- File import service function: `backend.netcomply_scans.services.import_scan_file`
- Thin management command wrapper: `python manage.py import_compliance_scan tmp/hcc-scans/mock_scan_payload.json`
- Scanner API management command: `python manage.py run_daily_scan_import`
- Celery task name: `hcc.run_daily_scan_import`
- File import Celery task name: `hcc.import_scan_file`

For the split schedule model:

- 6 a.m. job: call the scanner API and save the response file.
- 8 a.m. job/manual trigger: call `import_scan_file(path_to_json)` to parse that file into scan/device/finding/config tables.

The import parsing logic lives in `services.py`; endpoints, management commands, and Celery tasks are only callers.

If copying the service file in pieces, make sure these datetime imports and helper are included because scan, request, queue, and worker API responses all use it:

```python
from datetime import datetime, timezone as datetime_timezone

from django.utils import timezone


def api_datetime(value: datetime | None = None) -> str:
    current = value or timezone.now()
    if timezone.is_naive(current):
        current = timezone.make_aware(current, timezone.get_current_timezone())
    return current.astimezone(datetime_timezone.utc).isoformat().replace("+00:00", "Z")
```

Add the scanner connection and Celery beat schedule to your Django settings:

```python
from celery.schedules import crontab

HCC_SCAN_DB_ALIAS = "hcc"
HCC_SCAN_API_URL = "https://scanner.example/api/latest-scan"
HCC_SCAN_API_METHOD = "GET"
HCC_SCAN_API_TOKEN = ""
HCC_SCAN_API_HEADERS = {
    "Api-Key": "replace-me",
}
HCC_SCAN_API_TIMEOUT = 60
HCC_SCAN_API_VERIFY_SSL = True
HCC_SCAN_TMP_DIR = BASE_DIR / "tmp" / "hcc-scans"
HCC_SCAN_SOURCE = "external-api"
HCC_CONFIG_SNAPSHOT_DIR = BASE_DIR / "tmp" / "hcc-config-snapshots"
HCC_DEPLOYMENT_WORKER_HEARTBEAT_DIR = BASE_DIR / "tmp" / "hcc-deployment-workers"
HCC_DEPLOYMENT_EXECUTOR_URL = "http://127.0.0.1:9100/execute"
HCC_DEPLOYMENT_EXECUTOR_HEADERS = {}
HCC_DEPLOYMENT_EXECUTOR_TIMEOUT = 60
# Keep True while testing. Set False to call HCC_DEPLOYMENT_EXECUTOR_URL.
HCC_DEPLOYMENT_EXECUTOR_SIMULATE = True

CELERY_BROKER_URL = "redis://127.0.0.1:6379/0"
CELERY_RESULT_BACKEND = "redis://127.0.0.1:6379/1"
CELERY_TIMEZONE = "Asia/Singapore"
CELERY_BEAT_SCHEDULE = {
    "hcc-daily-scan-import": {
        "task": "hcc.run_daily_scan_import",
        "schedule": crontab(hour=1, minute=0),
    },
    "hcc-deployment-queue": {
        "task": "hcc.process_deployment_queue_once",
        "schedule": crontab(minute="*/5"),
    },
}
```

The deployment worker caches each executor response indefinitely in a Django file-backed cache shared by the web and worker processes. Retrieve the response by its HCC ticket ID without reading worker logs:

```text
GET /api/HCCFix/executor-response/?ticketId=<HCC_REQUEST_ID>
```

While the executor response contract is being confirmed, the worker stores the HTTP status, headers, raw body, and parsed JSON when available, then marks a ticket with executable policies as complete without interpreting response fields. A transport failure with no response still fails the queue item.

For the Vite frontend, configure these when the backend URL is different from the local default:

```text
VITE_HCC_REAL_API_BASE=https://127.0.0.1:8443/api/HCCFix
```

Ticket creation currently reads the requester email from the `sub` claim in the
`X-Auth` JWT cookie. This is a temporary decode-only integration: the token
signature and registered claims are not yet validated.

For local Windows development, run Celery with:

```bash
celery -A backend worker -l info --pool=solo
celery -A backend beat -l info
```

## Deployment worker without Celery or Redis

From the Django project folder that contains `manage.py`, run:

```bash
python manage.py run_hcc_deployment_worker
```

The process stays open and checks the database queue every five seconds. Stop it
cleanly with `Ctrl+C`. To use a different interval or a recognizable worker name:

```bash
python manage.py run_hcc_deployment_worker --poll-interval 10 --worker-id hcc-worker-01
```

For a single immediate queue check, useful during testing:

```bash
python manage.py run_hcc_deployment_worker --once
```

This command uses the same database locking, executor simulation/HTTP call, result
storage, and ticket status transitions as the Celery task.
