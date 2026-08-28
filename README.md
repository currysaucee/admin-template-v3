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

The backend exposes one shared scan import flow:

- Ad-hoc API trigger: `POST /api/HCCFix/scan/import/`
- Local mock scan trigger: `GET /api/HCCFix/scan/import-mock/`
- File import service function: `backend.netcomply_scans.services.import_scan_file`
- Thin management command wrapper: `python manage.py import_compliance_scan tmp/hcc-scans/mock_scan_payload.json`
- Scanner API management command: `python manage.py run_daily_scan_import`
- Celery task name: `hcc.run_daily_scan_import`
- File import Celery task name: `hcc.import_scan_file`

For local testing without a scanner API, put the scan response JSON here:

```text
tmp/hcc-scans/mock_scan_payload.json
```

Then trigger:

```text
GET /api/HCCFix/scan/import-mock/
```

That reads the local JSON file, saves a timestamped copy as the latest consumed scan, and imports it into the scan tables using the current timestamp. The `tmp/` folder is gitignored, so local scan payloads do not get pushed.

For the split schedule model:

- 6 a.m. job: call the scanner API and save the response file.
- 8 a.m. job/manual trigger: call `import_scan_file(path_to_json)` to parse that file into scan/device/finding/config tables.

The import parsing logic lives in `services.py`; endpoints, management commands, and Celery tasks are only callers.

Add the scanner connection and Celery beat schedule to your Django settings:

```python
from celery.schedules import crontab

HCC_SCAN_DB_ALIAS = "hcc"
HCC_SCAN_API_URL = "https://scanner.example/api/latest-scan"
HCC_SCAN_API_METHOD = "GET"
HCC_SCAN_API_TOKEN = ""
HCC_SCAN_API_HEADERS = {}
HCC_SCAN_API_TIMEOUT = 60
HCC_SCAN_API_VERIFY_SSL = True
HCC_SCAN_TMP_DIR = BASE_DIR / "tmp" / "hcc-scans"
HCC_SCAN_SOURCE = "external-api"
HCC_MOCK_SCAN_PAYLOAD_PATH = BASE_DIR / "tmp" / "hcc-scans" / "mock_scan_payload.json"
HCC_CONFIG_SNAPSHOT_DIR = BASE_DIR / "tmp" / "hcc-config-snapshots"
HCC_DEPLOYMENT_WORKER_HEARTBEAT_DIR = BASE_DIR / "tmp" / "hcc-deployment-workers"
HCC_DEPLOYMENT_EXECUTOR_URL = "http://127.0.0.1:9100/execute"
HCC_DEPLOYMENT_EXECUTOR_HEADERS = {}
HCC_DEPLOYMENT_EXECUTOR_TIMEOUT = 60

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

For the Vite frontend, configure these when the backend URL is different from the local default:

```text
VITE_HCC_REAL_API_BASE=https://127.0.0.1:8443/api/HCCFix
VITE_HCC_REAL_DEVICES_ENDPOINT=https://127.0.0.1:8443/api/HCCFix/scan/devices/
```

For local Windows development, run Celery with:

```bash
celery -A backend worker -l info --pool=solo
celery -A backend beat -l info
```
