#!/bin/sh

RUNTIME_DIR="${HCC_WORKER_RUNTIME_DIR:-${BACKEND_PATH:-.}/runtime}"
PID_FILE="${RUNTIME_DIR}/hcc-deployment-worker.pid"
LOG_FILE="${RUNTIME_DIR}/hcc-deployment-worker.log"
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

run_hcc_worker_setup() (
  set -u

  if [ -z "${BACKEND_PATH:-}" ]; then
    echo "[HCC worker] ERROR: BACKEND_PATH is not defined."
    return 1
  fi

  echo "[HCC worker] Backend directory: ${BACKEND_PATH}"
  echo "[HCC worker] Log file: ${LOG_FILE}"

  if [ ! -f "${BACKEND_PATH}/manage.py" ]; then
    echo "[HCC worker] ERROR: manage.py was not found at ${BACKEND_PATH}/manage.py"
    return 1
  fi

  if ! command -v python >/dev/null 2>&1; then
    echo "[HCC worker] ERROR: the python command was not found."
    return 1
  fi

  if ! mkdir -p "${RUNTIME_DIR}"; then
    echo "[HCC worker] ERROR: could not create runtime directory ${RUNTIME_DIR}."
    return 1
  fi

  stop_hcc_workers
  rm -f "${PID_FILE}" || true

  echo "[HCC worker] Starting worker with a ${POLL_INTERVAL}-second polling interval..."
  if ! cd "${BACKEND_PATH}"; then
    echo "[HCC worker] ERROR: could not enter backend directory ${BACKEND_PATH}."
    return 1
  fi
  nohup python manage.py run_hcc_deployment_worker \
    --worker-id "${WORKER_ID}" \
    --poll-interval "${POLL_INTERVAL}" \
    >> "${LOG_FILE}" 2>&1 &
  WORKER_PID=$!
  if ! printf '%s\n' "${WORKER_PID}" > "${PID_FILE}"; then
    echo "[HCC worker] ERROR: could not write PID file ${PID_FILE}."
    kill "${WORKER_PID}" 2>/dev/null || true
    return 1
  fi

  sleep 2

  if kill -0 "${WORKER_PID}" 2>/dev/null; then
    echo "[HCC worker] SUCCESS: worker is running with PID ${WORKER_PID}."
    echo "[HCC worker] Follow its output with: tail -f '${LOG_FILE}'"
    echo "[HCC worker] Stop it with: kill ${WORKER_PID}"
    return 0
  fi

  echo "[HCC worker] ERROR: worker exited during startup."
  rm -f "${PID_FILE}" || true
  echo "[HCC worker] Last log lines:"
  tail -n 30 "${LOG_FILE}" 2>/dev/null || echo "[HCC worker] No log output was written."
  return 1
)

if ! run_hcc_worker_setup; then
  echo "[HCC worker] WARNING: worker setup failed; continuing with the remaining deployment steps."
fi
