#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=ops/railway/common.sh
source "$SCRIPT_DIR/common.sh"

require_token

services=(api beat console miniapp postgres)

format_line() {
  local name="$1"; shift
  local json="$1"; shift
  python3 - <<'PY' "$name" "$json"
import json,sys
name=sys.argv[1]
raw=sys.argv[2]
if not raw.strip():
    print(f"{name:12s} | нет данных")
    sys.exit(0)
data=json.loads(raw)
if not data:
    print(f"{name:12s} | нет деплоев")
    sys.exit(0)
node=data[0]
status=node.get("status","?")
created=node.get("createdAt","?")
user=node.get("user",{}).get("name","unknown")
print(f"{name:12s} | {status:12s} | {created} | triggered by {user}")
PY
}

for svc in "${services[@]}"; do
  sid="$(service_id "$svc")"
  json="$(railway deployment list --service "$sid" --environment "$RAILWAY_ENVIRONMENT_ID" --limit 1 --json || true)"
  format_line "$svc" "$json"
done
