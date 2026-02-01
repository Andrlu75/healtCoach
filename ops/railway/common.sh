#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=ops/railway/config.sh
source "$ROOT_DIR/ops/railway/config.sh"

ENV_FILE="$ROOT_DIR/ops/railway/.env"
if [ -f "$ENV_FILE" ]; then
  # Export all variables from .env for Railway auth
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
  # Если переменная определена пустой строкой — удаляем, чтобы не перекрывать токен из конфигурации CLI.
  for v in RAILWAY_API_TOKEN RAILWAY_TOKEN RAILWAY_PROJECT_TOKEN; do
    if [ "${!v-}" = "" ]; then
      unset "$v"
    fi
  done
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "railway CLI is not installed or not on PATH" >&2
  exit 1
fi

require_token() {
  if [ -n "${RAILWAY_API_TOKEN:-}" ] || [ -n "${RAILWAY_TOKEN:-}" ] || [ -n "${RAILWAY_PROJECT_TOKEN:-}" ]; then
    return 0
  fi
  if railway whoami >/dev/null 2>&1; then
    return 0
  fi
  echo "Нужен токен Railway: положи его в ops/railway/.env или выполни 'railway login'." >&2
  exit 1
}

service_id() {
  case "$1" in
    console) echo "$RAILWAY_SERVICE_CONSOLE" ;;
    api|backend) echo "$RAILWAY_SERVICE_API" ;;
    miniapp) echo "$RAILWAY_SERVICE_MINIAPP" ;;
    celery) echo "$RAILWAY_SERVICE_CELERY" ;;
    beat) echo "$RAILWAY_SERVICE_BEAT" ;;
    postgres|db) echo "${RAILWAY_SERVICE_POSTGRES:-}" ;;
    redis) echo "$RAILWAY_SERVICE_REDIS" ;;
    *) echo "Unknown service: $1" >&2; exit 1 ;;
  esac
}

service_path() {
  case "$1" in
    console) echo "$ROOT_DIR/frontend/console" ;;
    miniapp) echo "$ROOT_DIR/frontend/miniapp" ;;
    api|backend|celery|beat) echo "$ROOT_DIR/backend" ;;
    redis) echo "$ROOT_DIR" ;;
    *) echo "Unknown service: $1" >&2; exit 1 ;;
  esac
}

# Keeps background PIDs for log multiplexing
start_bg_pids=()
cleanup_bg() {
  if [ ${#start_bg_pids[@]} -gt 0 ]; then
    kill "${start_bg_pids[@]}" 2>/dev/null || true
  fi
}
trap cleanup_bg EXIT
