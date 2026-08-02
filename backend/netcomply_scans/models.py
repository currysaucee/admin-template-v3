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
