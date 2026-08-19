from django.db import models


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
        return f"{self.source} @ {self.consumed_at:%Y-%m-%d %H:%M:%S}"


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
        return self.hostname


class ComplianceScanFinding(models.Model):
    device = models.ForeignKey(ComplianceScanDevice, related_name="findings", on_delete=models.CASCADE)
    policy_id = models.CharField(max_length=80)
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
        return f"{self.device.hostname} {self.policy_id}"


class ComplianceScanActualConfig(models.Model):
    device = models.ForeignKey(ComplianceScanDevice, related_name="actual_configs", on_delete=models.CASCADE)
    policy_id = models.CharField(max_length=80)
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
        return f"{self.device.hostname} {self.policy_id}"


class PolicySettingRecord(models.Model):
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_policy_setting"

    def __str__(self) -> str:
        return str(self.payload.get("settingNumber") or self.payload.get("id") or self.id)


class RemediationTemplateRecord(models.Model):
    template_key = models.CharField(max_length=180, unique=True)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_remediation_template"

    def __str__(self) -> str:
        return self.template_key


class TemplateRequestRecord(models.Model):
    request_id = models.CharField(max_length=80, unique=True)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_template_request"

    def __str__(self) -> str:
        return self.request_id


class RemediationTicketRecord(models.Model):
    ticket_id = models.CharField(max_length=80, unique=True)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "netcomply_scans"
        db_table = "netcomply_remediation_ticket"

    def __str__(self) -> str:
        return self.ticket_id


class DeploymentQueueItem(models.Model):
    queue_id = models.CharField(max_length=100, unique=True)
    ticket_id = models.CharField(max_length=80, db_index=True)
    ticket_payload = models.JSONField(default=dict)
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
