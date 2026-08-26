import json

from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .services import (
    delete_policy_settings,
    enqueue_ticket_for_deployment,
    extract_policy_settings_from_docx,
    latest_devices_for_frontend,
    list_deployment_queue_for_frontend,
    list_deployment_worker_heartbeats,
    list_policy_settings_for_frontend,
    list_template_requests_for_frontend,
    list_templates_for_frontend,
    list_tickets_for_frontend,
    process_next_deployment_queue_item,
    replace_policy_settings,
    replace_template_requests,
    replace_templates,
    replace_tickets,
    resolve_snapshot_file,
    run_daily_scan_import,
    run_mock_scan_import,
    set_ticket_status,
    upsert_policy_settings,
    upsert_ticket,
)


def read_json_body(request):
    if not request.body:
        return None
    return json.loads(request.body.decode("utf-8"))


def latest_scan_devices(request):
    return JsonResponse({"devices": latest_devices_for_frontend()})


@csrf_exempt
def run_scan_import(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        return JsonResponse({"scan": run_daily_scan_import()})
    except Exception as exc:
        return JsonResponse({"detail": f"Unable to run scan import: {exc}"}, status=500)


@csrf_exempt
def run_mock_scan_import_view(request):
    if request.method not in {"GET", "POST"}:
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        payload_path = request.GET.get("path") or None
        return JsonResponse({"scan": run_mock_scan_import(payload_path)})
    except Exception as exc:
        return JsonResponse({"detail": f"Unable to run mock scan import: {exc}"}, status=500)


def config_snapshot_download(request, filename):
    snapshot_path = resolve_snapshot_file(filename)
    if not snapshot_path:
        raise Http404("Device config snapshot not found")
    return FileResponse(
        snapshot_path.open("rb"),
        as_attachment=True,
        filename=snapshot_path.name,
        content_type="text/plain; charset=utf-8",
    )


@csrf_exempt
def policy_settings(request):
    if request.method == "GET":
        return JsonResponse({"policySettings": list_policy_settings_for_frontend()})
    if request.method == "POST":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("policySettings", [payload])
        return JsonResponse({"policySettings": upsert_policy_settings(values)})
    if request.method == "PUT":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("policySettings", [])
        return JsonResponse({"policySettings": replace_policy_settings(values)})
    if request.method == "DELETE":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("ids", payload.get("policySettingIds", []))
        return JsonResponse({"policySettings": delete_policy_settings(values)})
    return JsonResponse({"detail": "Method not allowed"}, status=405)


@csrf_exempt
def policy_settings_extract_document(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    uploaded_file = request.FILES.get("document")
    if not uploaded_file:
        return JsonResponse({"detail": "Upload a .docx file using the 'document' form field."}, status=400)
    if not uploaded_file.name.lower().endswith(".docx"):
        return JsonResponse({"detail": "Only .docx files are supported for this experimental extractor."}, status=400)
    try:
        extracted = extract_policy_settings_from_docx(uploaded_file)
    except Exception as exc:
        return JsonResponse({"detail": f"Unable to extract policy settings: {exc}"}, status=400)
    return JsonResponse({"policySettings": extracted})


@csrf_exempt
def templates(request):
    if request.method == "GET":
        return JsonResponse({"templates": list_templates_for_frontend()})
    if request.method == "PUT":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("templates", [])
        return JsonResponse({"templates": replace_templates(values)})
    return JsonResponse({"detail": "Method not allowed"}, status=405)


@csrf_exempt
def template_requests(request):
    if request.method == "GET":
        return JsonResponse({"templateRequests": list_template_requests_for_frontend()})
    if request.method == "PUT":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("templateRequests", [])
        return JsonResponse({"templateRequests": replace_template_requests(values)})
    return JsonResponse({"detail": "Method not allowed"}, status=405)


@csrf_exempt
def tickets(request):
    if request.method == "GET":
        return JsonResponse({"tickets": list_tickets_for_frontend()})
    if request.method == "POST":
        payload = read_json_body(request) or {}
        return JsonResponse({"ticket": upsert_ticket(payload)})
    if request.method == "PATCH":
        payload = read_json_body(request) or {}
        ticket_id = str(payload.get("ticketId") or payload.get("id") or "").strip()
        status = str(payload.get("status") or "").strip()
        if not ticket_id or not status:
            return JsonResponse({"detail": "ticketId and status are required"}, status=400)
        try:
            return JsonResponse({"ticket": set_ticket_status(ticket_id, status)})
        except Exception as exc:
            return JsonResponse({"detail": f"Unable to update ticket status: {exc}"}, status=400)
    if request.method == "PUT":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("tickets", [])
        return JsonResponse({"tickets": replace_tickets(values)})
    return JsonResponse({"detail": "Method not allowed"}, status=405)


@csrf_exempt
def deployment_queue(request):
    if request.method == "GET":
        return JsonResponse({"queue": list_deployment_queue_for_frontend(), "workerHealth": list_deployment_worker_heartbeats()})
    if request.method == "POST":
        payload = read_json_body(request) or {}
        ticket_id = str(payload.get("ticketId") or "").strip()
        actor = str(payload.get("actor") or "Current User")
        if not ticket_id:
            return JsonResponse({"detail": "ticketId is required"}, status=400)
        try:
            return JsonResponse({"queueItem": enqueue_ticket_for_deployment(ticket_id, actor=actor)})
        except Exception as exc:
            return JsonResponse({"detail": f"Unable to queue deployment: {exc}"}, status=400)
    return JsonResponse({"detail": "Method not allowed"}, status=405)


@csrf_exempt
def deployment_queue_process_next(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    payload = read_json_body(request) or {}
    worker_id = str(payload.get("workerId") or "manual-worker")
    return JsonResponse(process_next_deployment_queue_item(worker_id=worker_id))
