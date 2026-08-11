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
- Management command: `python manage.py run_daily_scan_import`
- Celery task name: `netcomply.run_daily_scan_import`

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
