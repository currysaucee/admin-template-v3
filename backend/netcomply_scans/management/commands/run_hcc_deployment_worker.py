from __future__ import annotations

import os
import socket
import time

from django.core.management.base import BaseCommand, CommandError

from backend.netcomply_scans.services import process_next_deployment_queue_item


class Command(BaseCommand):
    help = "Continuously process the HCC deployment database queue without Celery or Redis."

    def add_arguments(self, parser):
        parser.add_argument(
            "--poll-interval",
            type=float,
            default=5.0,
            help="Seconds to wait when no queue item is available (default: 5).",
        )
        parser.add_argument(
            "--worker-id",
            default="",
            help="Worker name recorded against claimed queue items.",
        )
        parser.add_argument(
            "--once",
            action="store_true",
            help="Process at most one queue item and exit.",
        )

    def handle(self, *args, **options):
        poll_interval = options["poll_interval"]
        if poll_interval <= 0:
            raise CommandError("--poll-interval must be greater than zero.")

        worker_id = options["worker_id"].strip() or f"{socket.gethostname()}-{os.getpid()}"
        run_once = options["once"]
        processed_count = 0
        self.stdout.write(self.style.SUCCESS(
            f"HCC deployment worker {worker_id} started; polling every {poll_interval:g} seconds."
        ))

        try:
            while True:
                try:
                    result = process_next_deployment_queue_item(worker_id=worker_id)
                except Exception as exc:
                    if run_once:
                        raise CommandError(f"Unable to process deployment queue: {exc}") from exc
                    self.stderr.write(self.style.ERROR(f"Queue polling failed: {exc}"))
                    time.sleep(poll_interval)
                    continue

                if result.get("claimed"):
                    processed_count += 1
                    queue_item = result.get("queueItem") or {}
                    queue_id = queue_item.get("queueId") or "unknown queue item"
                    status = queue_item.get("status") or "Unknown"
                    self.stdout.write(f"Processed {queue_id}: {status}")

                if run_once:
                    break
                if not result.get("claimed"):
                    time.sleep(poll_interval)
        except KeyboardInterrupt:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Stop requested; deployment worker is shutting down."))

        self.stdout.write(self.style.SUCCESS(
            f"HCC deployment worker stopped after processing {processed_count} item(s)."
        ))
