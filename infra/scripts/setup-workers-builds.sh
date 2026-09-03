#!/usr/bin/env bash
set -euo pipefail

# Wire groxbot monorepo to Cloudflare Workers Builds (GitHub -> auto deploy on push).
# Prerequisite: install the Cloudflare GitHub App once via dashboard:
# Workers & Pages -> any Worker -> Settings -> Builds -> Connect -> GitHub.

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-67f961331110b81774851ee4f54349b9}"
GITHUB_USER_ID="${GITHUB_USER_ID:-12745166}"
GITHUB_USERNAME="${GITHUB_USERNAME:-muhajirdev}"
REPO_ID="${GITHUB_REPO_ID:-1334749004}"
REPO_NAME="${GITHUB_REPO_NAME:-groxbot}"
PRODUCTION_BRANCH="${WORKERS_BUILDS_BRANCH:-main}"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  WRANGLER_CONFIG="${HOME}/.wrangler/config/default.toml"
  if [[ -f "${WRANGLER_CONFIG}" ]]; then
    CLOUDFLARE_API_TOKEN="$(python3 - <<'PY'
import tomllib, pathlib, sys
path = pathlib.Path.home() / ".wrangler/config/default.toml"
data = tomllib.loads(path.read_text())
print(data.get("oauth_token", ""))
PY
)"
  fi
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Set CLOUDFLARE_API_TOKEN (Workers Builds Configuration: Edit) or run: wrangler login"
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  if [[ -n "${data}" ]]; then
    curl -sS "https://api.cloudflare.com/client/v4${path}" \
      -X "${method}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "${data}"
  else
    curl -sS "https://api.cloudflare.com/client/v4${path}" \
      -X "${method}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
  fi
}

require_success() {
  local label="$1"
  local response="$2"
  python3 - <<'PY' "${label}" "${response}"
import json, sys
label, raw = sys.argv[1], sys.argv[2]
data = json.loads(raw)
if not data.get("success"):
    print(f"{label} failed:", json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
print(json.dumps(data.get("result"), indent=2))
PY
}

echo "==> Connecting GitHub repo ${GITHUB_USERNAME}/${REPO_NAME}"
CONNECTION_RESPONSE="$(api PUT "/accounts/${ACCOUNT_ID}/builds/repos/connections" "$(cat <<JSON
{
  "provider_type": "github",
  "provider_account_id": "${GITHUB_USER_ID}",
  "provider_account_name": "${GITHUB_USERNAME}",
  "repo_id": "${REPO_ID}",
  "repo_name": "${REPO_NAME}"
}
JSON
)")"
CONNECTION="$(require_success "repo connection" "${CONNECTION_RESPONSE}")"
REPO_CONNECTION_UUID="$(python3 - <<'PY' "${CONNECTION}"
import json, sys
print(json.loads(sys.argv[1])["repo_connection_uuid"])
PY
)"
echo "repo_connection_uuid=${REPO_CONNECTION_UUID}"

echo "==> Resolving build token"
TOKENS_RESPONSE="$(api GET "/accounts/${ACCOUNT_ID}/builds/tokens")"
BUILD_TOKEN_UUID="$(python3 - <<'PY' "${TOKENS_RESPONSE}"
import json, sys
data = json.loads(sys.argv[1])
tokens = data.get("result") or []
if not tokens:
    raise SystemExit("No build tokens found. Create one in dashboard: Worker -> Settings -> Builds -> API token")
print(tokens[0]["build_token_uuid"])
PY
)"
echo "build_token_uuid=${BUILD_TOKEN_UUID}"

echo "==> Loading worker tags"
SCRIPTS_RESPONSE="$(api GET "/accounts/${ACCOUNT_ID}/workers/scripts")"
require_success "workers/scripts" "${SCRIPTS_RESPONSE}" >/dev/null

declare -A WORKER_TAGS=(
  ["groxbot-api"]="1fd37c5f076445c3a7770110d11af994"
  ["groxbot-web"]="e20e26171c3745fcac819ca0f694b751"
  ["groxbot-landing"]="a610c3aa604a47df88827519a6941794"
)

declare -A DEPLOY_COMMANDS=(
  ["groxbot-api"]="corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm deploy:api"
  ["groxbot-web"]="corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm deploy:web"
  ["groxbot-landing"]="corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm deploy:landing"
)

declare -A PATH_INCLUDES=(
  ["groxbot-api"]='["apps/api/**","packages/**","pnpm-lock.yaml","pnpm-workspace.yaml","package.json","turbo.json"]'
  ["groxbot-web"]='["apps/web/**","packages/**","pnpm-lock.yaml","pnpm-workspace.yaml","package.json","turbo.json"]'
  ["groxbot-landing"]='["apps/landing/**","packages/**","pnpm-lock.yaml","pnpm-workspace.yaml","package.json","turbo.json"]'
)

for worker in groxbot-api groxbot-web groxbot-landing; do
  tag="${WORKER_TAGS[$worker]}"
  echo "==> Configuring ${worker} (${tag})"

  EXISTING="$(api GET "/accounts/${ACCOUNT_ID}/builds/workers/${tag}/triggers")"
  EXISTING_UUID="$(python3 - <<'PY' "${EXISTING}"
import json, sys
data = json.loads(sys.argv[1])
if not data.get("success"):
    print("")
    raise SystemExit(0)
for trigger in data.get("result") or []:
    branches = trigger.get("branch_includes") or []
    if "main" in branches or "*" in branches:
        print(trigger.get("trigger_uuid", ""))
        break
PY
)"

  PAYLOAD="$(cat <<JSON
{
  "external_script_id": "${tag}",
  "repo_connection_uuid": "${REPO_CONNECTION_UUID}",
  "build_token_uuid": "${BUILD_TOKEN_UUID}",
  "trigger_name": "Deploy ${PRODUCTION_BRANCH}",
  "build_command": "",
  "deploy_command": "${DEPLOY_COMMANDS[$worker]}",
  "root_directory": "/",
  "branch_includes": ["${PRODUCTION_BRANCH}"],
  "branch_excludes": [],
  "path_includes": ${PATH_INCLUDES[$worker]},
  "path_excludes": [],
  "build_caching_enabled": true
}
JSON
)"

  if [[ -n "${EXISTING_UUID}" ]]; then
    echo "  updating trigger ${EXISTING_UUID}"
    TRIGGER_RESPONSE="$(api PATCH "/accounts/${ACCOUNT_ID}/builds/triggers/${EXISTING_UUID}" "${PAYLOAD}")"
  else
    echo "  creating production trigger"
    TRIGGER_RESPONSE="$(api POST "/accounts/${ACCOUNT_ID}/builds/triggers" "${PAYLOAD}")"
  fi
  TRIGGER="$(require_success "${worker} trigger" "${TRIGGER_RESPONSE}")"
  TRIGGER_UUID="$(python3 - <<'PY' "${TRIGGER}"
import json, sys
result = json.loads(sys.argv[1])
print(result.get("trigger_uuid") or result.get("uuid") or "")
PY
)"
  echo "  trigger_uuid=${TRIGGER_UUID}"

  echo "  triggering initial build on ${PRODUCTION_BRANCH}"
  BUILD_RESPONSE="$(api POST "/accounts/${ACCOUNT_ID}/builds/triggers/${TRIGGER_UUID}/builds" "{\"branch\":\"${PRODUCTION_BRANCH}\"}")"
  require_success "${worker} initial build" "${BUILD_RESPONSE}" >/dev/null
done

echo "Done. Push to ${PRODUCTION_BRANCH} will auto-deploy groxbot-api, groxbot-web, and groxbot-landing."
