#!/bin/sh

set -u

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${HCC_WORKER_RUNTIME_DIR:-${PROJECT_DIR}/runtime}"
PID_FILE="${RUNTIME_DIR}/hcc-deployment-worker.pid"
LOG_FILE="${RUNTIME_DIR}/hcc-deployment-worker.log"
PYTHON_BIN="${PYTHON_BIN:-python3}"
WORKER_ID="${HCC_WORKER_ID:-hcc-deployment-worker}"
POLL_INTERVAL="${HCC_WORKER_POLL_INTERVAL:-5}"
STOP_TIMEOUT="${HCC_WORKER_STOP_TIMEOUT:-20}"

is_hcc_worker_pid() {
  hcc_check_pid="$1"

  case "${hcc_check_pid}" in
    ''|*[!0-9]*) return 1 ;;
  esac
  kill -0 "${hcc_check_pid}" 2>/dev/null || return 1
  hcc_process_command="$(ps -p "${hcc_check_pid}" -o args= 2>/dev/null || true)"
  case "${hcc_process_command}" in
    *"manage.py run_hcc_deployment_worker"*) return 0 ;;
    *) return 1 ;;
  esac
}

stop_hcc_workers() {
  hcc_worker_pids=""
  hcc_candidate_pids="$(ps -eo pid=,args= 2>/dev/null | awk '/[m]anage.py run_hcc_deployment_worker/ {print $1}')"
  for hcc_pid in ${hcc_candidate_pids}; do
    if is_hcc_worker_pid "${hcc_pid}"; then
      hcc_worker_pids="${hcc_worker_pids} ${hcc_pid}"
    fi
  done

  if [ -z "${hcc_worker_pids# }" ]; then
    echo "[HCC worker] No existing worker process was found."
    return
  fi

  set -- ${hcc_worker_pids}
  echo "[HCC worker] Stopping $# existing worker process(es):$hcc_worker_pids"
  kill "$@" 2>/dev/null || true

  hcc_seconds_waited=0
  while [ "${hcc_seconds_waited}" -lt "${STOP_TIMEOUT}" ]; do
    hcc_any_running=0
    for hcc_pid in ${hcc_worker_pids}; do
      if kill -0 "${hcc_pid}" 2>/dev/null; then
        hcc_any_running=1
        break
      fi
    done
    [ "${hcc_any_running}" -eq 0 ] && break
    sleep 1
    hcc_seconds_waited=$((hcc_seconds_waited + 1))
  done

  for hcc_pid in ${hcc_worker_pids}; do
    if kill -0 "${hcc_pid}" 2>/dev/null; then
      echo "[HCC worker] Worker PID ${hcc_pid} did not stop after ${STOP_TIMEOUT} seconds; forcing it to stop."
      kill -KILL "${hcc_pid}" 2>/dev/null || true
    fi
  done
  echo "[HCC worker] Existing worker processes stopped."
}

echo "[HCC worker] Project directory: ${PROJECT_DIR}"
echo "[HCC worker] Python command: ${PYTHON_BIN}"
echo "[HCC worker] Log file: ${LOG_FILE}"

if [ ! -f "${PROJECT_DIR}/manage.py" ]; then
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

stop_hcc_workers
rm -f "${PID_FILE}"

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
