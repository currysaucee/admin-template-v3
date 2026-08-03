import json

from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .services import (
    latest_devices_for_frontend,
    list_policy_settings_for_frontend,
    list_template_requests_for_frontend,
    list_templates_for_frontend,
    list_tickets_for_frontend,
    replace_policy_settings,
    replace_template_requests,
    replace_templates,
    replace_tickets,
    resolve_snapshot_file,
    upsert_ticket,
)


def read_json_body(request):
    if not request.body:
        return None
    return json.loads(request.body.decode("utf-8"))


def latest_scan_devices(request):
    return JsonResponse({"devices": latest_devices_for_frontend()})


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
    if request.method == "PUT":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("policySettings", [])
        return JsonResponse({"policySettings": replace_policy_settings(values)})
    return JsonResponse({"detail": "Method not allowed"}, status=405)


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
    if request.method == "PUT":
        payload = read_json_body(request) or {}
        values = payload if isinstance(payload, list) else payload.get("tickets", [])
        return JsonResponse({"tickets": replace_tickets(values)})
    return JsonResponse({"detail": "Method not allowed"}, status=405)
