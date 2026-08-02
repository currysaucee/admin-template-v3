from django.urls import path

from .views import latest_scan_devices, policy_settings, template_requests, templates, tickets

urlpatterns = [
    path("api/netcomply/scan/devices/", latest_scan_devices, name="netcomply_latest_scan_devices"),
    path("api/hcc/scan/devices/", latest_scan_devices, name="hcc_latest_scan_devices"),
    path("api/hcc/policy-settings/", policy_settings, name="hcc_policy_settings"),
    path("api/hcc/templates/", templates, name="hcc_templates"),
    path("api/hcc/template-requests/", template_requests, name="hcc_template_requests"),
    path("api/hcc/tickets/", tickets, name="hcc_tickets"),
]
