#!/usr/bin/env bash
set -euo pipefail

# Opens an interactive shell into the specified service container.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=ops/railway/common.sh
source "$SCRIPT_DIR/common.sh"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <api|celery|beat|console|miniapp|redis>" >&2
  exit 1
fi

require_token
service="$1"
id="$(service_id "$service")"

railway ssh --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT_ID" --service "$id"
