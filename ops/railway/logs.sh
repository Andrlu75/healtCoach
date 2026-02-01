#!/usr/bin/env bash
set -euo pipefail

# Streams logs for one or more services with prefixes. Defaults to all runtime services.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=ops/railway/common.sh
source "$SCRIPT_DIR/common.sh"

require_token

services=("${@:-all}")
if [ "${services[*]}" = "all" ]; then
  services=(api celery beat console miniapp)
fi

log_one() {
  local service="$1"
  local id
  id="$(service_id "$service")"
  echo "[logs] $service ($id)"
  railway logs --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT_ID" --service "$id" --lines "$RAILWAY_LOG_LINES" --follow |
    sed -u "s/^/[$service] /" &
  start_bg_pids+=("$!")
}

for svc in "${services[@]}"; do
  log_one "$svc"
done

wait
