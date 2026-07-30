from django.urls import path

from .views import latest_scan_devices

urlpatterns = [
    path("api/netcomply/scan/devices/", latest_scan_devices, name="netcomply_latest_scan_devices"),
]
