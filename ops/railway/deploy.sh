#!/usr/bin/env bash
set -euo pipefail

# Deploys one or more services with the correct root context.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=ops/railway/common.sh
source "$SCRIPT_DIR/common.sh"

require_token

services=("${@:-all}")
if [ "${services[*]}" = "all" ]; then
  services=(console miniapp api beat)
fi

deploy_one() {
  local service="$1"
  local id
  local path
  id="$(service_id "$service")"
  path="$(service_path "$service")"

  echo "Deploying $service from $path"
  railway up --service "$id" "$path"
}

for svc in "${services[@]}"; do
  deploy_one "$svc"
done
