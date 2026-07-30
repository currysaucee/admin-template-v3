from django.http import JsonResponse

from .services import latest_devices_for_frontend


def latest_scan_devices(request):
    return JsonResponse({"devices": latest_devices_for_frontend()})
