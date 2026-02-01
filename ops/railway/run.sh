#!/usr/bin/env bash
set -euo pipefail

# Runs a non-interactive command inside a service via SSH.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=ops/railway/common.sh
source "$SCRIPT_DIR/common.sh"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <service> <command...>" >&2
  exit 1
fi

require_token
service="$1"
shift
id="$(service_id "$service")"

railway ssh --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT_ID" --service "$id" -- "$@"
