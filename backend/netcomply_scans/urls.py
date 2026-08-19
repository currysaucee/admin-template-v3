from django.urls import path

from .views import config_snapshot_download, deployment_queue, deployment_queue_process_next, latest_scan_devices, policy_settings, policy_settings_extract_document, run_mock_scan_import_view, run_scan_import, template_requests, templates, tickets

urlpatterns = [
    path("api/netcomply/scan/devices/", latest_scan_devices, name="netcomply_latest_scan_devices"),
    path("api/netcomply/scan/import/", run_scan_import, name="netcomply_run_scan_import"),
    path("api/netcomply/scan/import-mock/", run_mock_scan_import_view, name="netcomply_run_mock_scan_import"),
    path("api/netcomply/scan/config-snapshots/<str:filename>", config_snapshot_download, name="netcomply_config_snapshot_download"),
    path("api/HCCFix/scan/import/", run_scan_import, name="hccfix_run_scan_import"),
    path("api/HCCFix/scan/import-mock/", run_mock_scan_import_view, name="hccfix_run_mock_scan_import"),
    path("api/HCCFix/scan/config-snapshots/<str:filename>", config_snapshot_download, name="hccfix_config_snapshot_download"),
    path("api/hcc/scan/devices/", latest_scan_devices, name="hcc_latest_scan_devices"),
    path("api/hcc/scan/import/", run_scan_import, name="hcc_run_scan_import"),
    path("api/hcc/scan/import-mock/", run_mock_scan_import_view, name="hcc_run_mock_scan_import"),
    path("api/hcc/scan/config-snapshots/<str:filename>", config_snapshot_download, name="hcc_config_snapshot_download"),
    path("api/hcc/policy-settings/", policy_settings, name="hcc_policy_settings"),
    path("api/hcc/policy-settings/extract-document/", policy_settings_extract_document, name="hcc_policy_settings_extract_document"),
    path("api/HCCFix/policy-settings/", policy_settings, name="hccfix_policy_settings"),
    path("api/HCCFix/policy-settings/extract-document/", policy_settings_extract_document, name="hccfix_policy_settings_extract_document"),
    path("api/hcc/templates/", templates, name="hcc_templates"),
    path("api/hcc/template-requests/", template_requests, name="hcc_template_requests"),
    path("api/hcc/tickets/", tickets, name="hcc_tickets"),
    path("api/hcc/deployment-queue/", deployment_queue, name="hcc_deployment_queue"),
    path("api/hcc/deployment-queue/process-next/", deployment_queue_process_next, name="hcc_deployment_queue_process_next"),
    path("api/HCCFix/deployment-queue/", deployment_queue, name="hccfix_deployment_queue"),
    path("api/HCCFix/deployment-queue/process-next/", deployment_queue_process_next, name="hccfix_deployment_queue_process_next"),
]
