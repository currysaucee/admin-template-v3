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

- Ad-hoc API trigger: `POST /api/hcc/scan/import/`
- Compatibility API trigger: `POST /api/HCCFix/scan/import/`
- Local mock scan trigger: `GET /api/hcc/scan/import-mock/`
- File import service function: `backend.netcomply_scans.services.import_scan_file`
- Thin management command wrapper: `python manage.py import_compliance_scan tmp/netcomply-scans/mock_scan_payload.json`
- Scanner API management command: `python manage.py run_daily_scan_import`
- Celery task name: `netcomply.run_daily_scan_import`
- File import Celery task name: `netcomply.import_scan_file`

For local testing without a scanner API, put the scan response JSON here:

```text
tmp/netcomply-scans/mock_scan_payload.json
```

Then trigger:

```text
GET /api/hcc/scan/import-mock/
```

That reads the local JSON file, saves a timestamped copy as the latest consumed scan, and imports it into the scan tables using the current timestamp. The `tmp/` folder is gitignored, so local scan payloads do not get pushed.

For the split schedule model:

- 6 a.m. job: call the scanner API and save the response file.
- 8 a.m. job/manual trigger: call `import_scan_file(path_to_json)` to parse that file into scan/device/finding/config tables.

The import parsing logic lives in `services.py`; endpoints, management commands, and Celery tasks are only callers.

Add the scanner connection and Celery beat schedule to your Django settings:

```python
from celery.schedules import crontab

NETCOMPLY_SCAN_DB_ALIAS = "hcc"
NETCOMPLY_SCAN_API_URL = "https://scanner.example/api/latest-scan"
NETCOMPLY_SCAN_API_METHOD = "GET"
NETCOMPLY_SCAN_API_TOKEN = ""
NETCOMPLY_SCAN_API_HEADERS = {}
NETCOMPLY_SCAN_API_TIMEOUT = 60
NETCOMPLY_SCAN_API_VERIFY_SSL = True
NETCOMPLY_SCAN_TMP_DIR = BASE_DIR / "tmp" / "netcomply-scans"
NETCOMPLY_SCAN_SOURCE = "external-api"

CELERY_BROKER_URL = "redis://127.0.0.1:6379/0"
CELERY_RESULT_BACKEND = "redis://127.0.0.1:6379/1"
CELERY_TIMEZONE = "Asia/Singapore"
CELERY_BEAT_SCHEDULE = {
    "netcomply-daily-scan-import": {
        "task": "netcomply.run_daily_scan_import",
        "schedule": crontab(hour=1, minute=0),
    },
}
```

For local Windows development, run Celery with:

```bash
celery -A backend worker -l info --pool=solo
celery -A backend beat -l info
```
