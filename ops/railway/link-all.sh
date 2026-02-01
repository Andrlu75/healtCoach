#!/usr/bin/env bash
set -euo pipefail

# Links every service directory to the Railway project/environment/service IDs non-interactively.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=ops/railway/common.sh
source "$SCRIPT_DIR/common.sh"

require_token

link_one() {
  local service="$1"
  local id
  local path
  id="$(service_id "$service")"
  path="$(service_path "$service")"

  echo "Linking $service -> $id ($path)"
  (cd "$path" && railway link --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT_ID" --service "$id")
}

link_one api
link_one celery
link_one beat
link_one console
link_one miniapp

printf "All service directories now linked to project %s env %s\n" "$RAILWAY_PROJECT_ID" "$RAILWAY_ENVIRONMENT_ID"
