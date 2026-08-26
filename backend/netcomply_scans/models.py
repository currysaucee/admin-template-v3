from django.db import models


def stringify_model_fields(instance: models.Model) -> str:
    values = []
    for field in instance._meta.fields:
        values.append(f"{field.name}={getattr(instance, field.name)!r}")
    return f"{instance.__class__.__name__}({', '.join(values)})"


class BaseRequest(models.Model):
    # When porting into the portal, replace this abstract base with the
    # existing Request model import that HCCRequestRecord should extend.
    class Meta:
        abstract = True


class ComplianceScanBatch(models.Model):
    source = models.CharField(max_length=120, default="external-api")
    consumed_at = models.DateTimeField()
    raw_payload_path = models.CharField(max_length=500)
    device_count = models.PositiveIntegerField(default=0)
    non_compliant_device_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_compliance_scan_batch"
        ordering = ["-consumed_at"]

    def __str__(self) -> str:
        return stringify_model_fields(self)


class ComplianceScanDevice(models.Model):
    batch = models.ForeignKey(ComplianceScanBatch, related_name="devices", on_delete=models.CASCADE)
    hostname = models.CharField(max_length=255)
    hardware_type = models.CharField(max_length=120)
    management_ip = models.CharField(max_length=64)
    site = models.CharField(max_length=120)
    role = models.CharField(max_length=120, blank=True, default="")
    comply_status = models.BooleanField(default=False)
    raw_payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_compliance_scan_device"
        indexes = [
            models.Index(fields=["batch", "hostname"]),
            models.Index(fields=["hardware_type"]),
            models.Index(fields=["comply_status"]),
        ]

    def __str__(self) -> str:
        return stringify_model_fields(self)


class ComplianceScanFinding(models.Model):
    device = models.ForeignKey(ComplianceScanDevice, related_name="findings", on_delete=models.CASCADE)
    policy_id = models.CharField(max_length=80)
    policy_title = models.CharField(max_length=255, blank=True, default="")
    policy_type = models.CharField(max_length=120, blank=True, default="")
    policy_description = models.TextField(blank=True, default="")
    expected_config = models.TextField(blank=True, default="")
    finding_payload = models.TextField()
    current_value = models.TextField(blank=True, default="")
    raw_payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_compliance_scan_finding"
        indexes = [
            models.Index(fields=["policy_id"]),
            models.Index(fields=["device", "policy_id"]),
        ]

    def __str__(self) -> str:
        return stringify_model_fields(self)


class ComplianceScanActualConfig(models.Model):
    device = models.ForeignKey(ComplianceScanDevice, related_name="actual_configs", on_delete=models.CASCADE)
    policy_id = models.CharField(max_length=80)
    current_config = models.TextField(blank=True, default="")
    config_payload = models.TextField()
    raw_payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_compliance_scan_actual_config"
        indexes = [
            models.Index(fields=["policy_id"]),
            models.Index(fields=["device", "policy_id"]),
        ]

    def __str__(self) -> str:
        return stringify_model_fields(self)


class PolicySettingRecord(models.Model):
    setting_number = models.CharField(max_length=80, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    setting_payload = models.TextField()
    standard = models.CharField(max_length=120, blank=True, default="")
    description = models.TextField(blank=True, default="")
    updated_by = models.CharField(max_length=120, blank=True, default="")
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_policy_setting"

    def __str__(self) -> str:
        return stringify_model_fields(self)


class RemediationTemplateRecord(models.Model):
    template_key = models.CharField(max_length=180, unique=True)
    policy_setting_id = models.CharField(max_length=80, blank=True, default="", db_index=True)
    finding_name = models.CharField(max_length=255, blank=True, default="")
    agreed_setting = models.TextField(blank=True, default="")
    standard = models.CharField(max_length=120, blank=True, default="")
    hardware_types = models.JSONField(default=list)
    implementation_commands = models.JSONField(default=list)
    failure_behaviour = models.TextField(blank=True, default="")
    approval_status = models.CharField(max_length=40, blank=True, default="Pending Approval", db_index=True)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_remediation_template"

    def __str__(self) -> str:
        return stringify_model_fields(self)


class TemplateRequestRecord(models.Model):
    request_id = models.CharField(max_length=80, unique=True)
    template_key = models.CharField(max_length=180, db_index=True)
    finding_name = models.CharField(max_length=255, blank=True, default="")
    hardware_type = models.CharField(max_length=120, blank=True, default="")
    policy_setting_title = models.CharField(max_length=255, blank=True, default="")
    requestor = models.CharField(max_length=120, blank=True, default="")
    submitter_comment = models.TextField(blank=True, default="")
    status = models.CharField(max_length=40, blank=True, default="Pending Approval", db_index=True)
    reviewer = models.CharField(max_length=120, blank=True, default="")
    review_note = models.TextField(blank=True, default="")
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_template_request"

    def __str__(self) -> str:
        return stringify_model_fields(self)


class HCCRequestRecord(BaseRequest):
    request_id = models.CharField(max_length=80, unique=True)
    external_change_id = models.CharField(max_length=120, blank=True, default="")
    requestor = models.CharField(max_length=120, blank=True, default="")
    requestor_role = models.CharField(max_length=120, blank=True, default="")
    implementation_date = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=40, blank=True, default="Pending Approval", db_index=True)
    device_count = models.PositiveIntegerField(default=0)
    finding_count = models.PositiveIntegerField(default=0)
    implementation_plan = models.TextField(blank=True, default="")
    backout_plan = models.TextField(blank=True, default="")
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_hcc_request"

    def __str__(self) -> str:
        return stringify_model_fields(self)


class DeploymentQueueItem(models.Model):
    queue_id = models.CharField(max_length=100, unique=True)
    ticket_id = models.CharField(max_length=80, db_index=True)
    ticket_payload = models.JSONField(default=dict)
    execution_plan = models.JSONField(default=dict)
    status = models.CharField(max_length=40, default="Queued", db_index=True)
    priority = models.PositiveIntegerField(default=100)
    available_at = models.DateTimeField()
    queued_at = models.DateTimeField()
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.CharField(max_length=120, blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    attempt_count = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    result_payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_deployment_queue"
        indexes = [
            models.Index(fields=["status", "available_at"]),
            models.Index(fields=["ticket_id"]),
            models.Index(fields=["locked_at"]),
        ]

    def __str__(self) -> str:
        return self.queue_id
