#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${HCC_WORKER_RUNTIME_DIR:-${PROJECT_DIR}/runtime}"
PID_FILE="${RUNTIME_DIR}/hcc-deployment-worker.pid"
LOG_FILE="${RUNTIME_DIR}/hcc-deployment-worker.log"
PYTHON_BIN="${PYTHON_BIN:-python3}"
WORKER_ID="${HCC_WORKER_ID:-hcc-deployment-worker}"
POLL_INTERVAL="${HCC_WORKER_POLL_INTERVAL:-5}"

echo "[HCC worker] Project directory: ${PROJECT_DIR}"
echo "[HCC worker] Python command: ${PYTHON_BIN}"
echo "[HCC worker] Log file: ${LOG_FILE}"

if [[ ! -f "${PROJECT_DIR}/manage.py" ]]; then
  echo "[HCC worker] ERROR: manage.py was not found at ${PROJECT_DIR}/manage.py"
  echo "[HCC worker] Put this script in the project's scripts directory and try again."
  exit 1
fi

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  echo "[HCC worker] ERROR: Python command '${PYTHON_BIN}' was not found."
  echo "[HCC worker] Set PYTHON_BIN to the correct executable or virtual-environment Python path."
  exit 1
fi

mkdir -p "${RUNTIME_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(tr -d '[:space:]' < "${PID_FILE}")"
  if [[ "${EXISTING_PID}" =~ ^[0-9]+$ ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "[HCC worker] Already running with PID ${EXISTING_PID}."
    echo "[HCC worker] Recent log output:"
    tail -n 10 "${LOG_FILE}" 2>/dev/null || true
    exit 0
  fi
  echo "[HCC worker] Found a stale PID file; starting a new worker."
fi

echo "[HCC worker] Starting worker with a ${POLL_INTERVAL}-second polling interval..."
cd "${PROJECT_DIR}" || exit 1
nohup "${PYTHON_BIN}" manage.py run_hcc_deployment_worker \
  --worker-id "${WORKER_ID}" \
  --poll-interval "${POLL_INTERVAL}" \
  >> "${LOG_FILE}" 2>&1 &
WORKER_PID=$!
printf '%s\n' "${WORKER_PID}" > "${PID_FILE}"

sleep 2

if kill -0 "${WORKER_PID}" 2>/dev/null; then
  echo "[HCC worker] SUCCESS: worker is running with PID ${WORKER_PID}."
  echo "[HCC worker] Follow its output with: tail -f '${LOG_FILE}'"
  echo "[HCC worker] Stop it with: kill ${WORKER_PID}"
  exit 0
fi

echo "[HCC worker] ERROR: worker exited during startup."
echo "[HCC worker] Last log lines:"
tail -n 30 "${LOG_FILE}" 2>/dev/null || echo "[HCC worker] No log output was written."
exit 1
