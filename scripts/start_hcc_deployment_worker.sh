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
STOP_TIMEOUT="${HCC_WORKER_STOP_TIMEOUT:-20}"

is_hcc_worker_pid() {
  local pid="$1"
  local process_command

  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  kill -0 "${pid}" 2>/dev/null || return 1
  process_command="$(ps -p "${pid}" -o args= 2>/dev/null || true)"
  [[ "${process_command}" == *"manage.py run_hcc_deployment_worker"* ]]
}

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
  if is_hcc_worker_pid "${EXISTING_PID}"; then
    echo "[HCC worker] Stopping existing worker with PID ${EXISTING_PID}..."
    kill "${EXISTING_PID}"

    SECONDS_WAITED=0
    while kill -0 "${EXISTING_PID}" 2>/dev/null && (( SECONDS_WAITED < STOP_TIMEOUT )); do
      sleep 1
      ((SECONDS_WAITED += 1))
    done

    if kill -0 "${EXISTING_PID}" 2>/dev/null; then
      echo "[HCC worker] Existing worker did not stop after ${STOP_TIMEOUT} seconds; forcing it to stop."
      kill -KILL "${EXISTING_PID}"
    fi

    echo "[HCC worker] Existing worker stopped."
  elif [[ "${EXISTING_PID}" =~ ^[0-9]+$ ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "[HCC worker] WARNING: PID ${EXISTING_PID} belongs to another process; it will not be stopped."
  else
    echo "[HCC worker] Found a stale PID file."
  fi
  rm -f "${PID_FILE}"
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
rm -f "${PID_FILE}"
echo "[HCC worker] Last log lines:"
tail -n 30 "${LOG_FILE}" 2>/dev/null || echo "[HCC worker] No log output was written."
exit 1
