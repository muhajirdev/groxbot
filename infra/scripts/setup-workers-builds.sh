#!/usr/bin/env bash
set -euo pipefail

# Wire groxbot monorepo to Cloudflare Workers Builds (GitHub -> auto deploy).
# Prerequisite: install the Cloudflare GitHub App once via dashboard:
# Workers & Pages -> any Worker -> Settings -> Builds -> Connect -> GitHub.
#
# Preview must run `pnpm upload:*` from the repo root. `npx wrangler versions
# upload` at `/` fails because wrangler.jsonc lives under apps/<name>.
#
# Requires CLOUDFLARE_API_TOKEN (Workers Builds Configuration: Edit).
# Set WORKERS_BUILDS_TRIGGER_BUILD=1 to kick a production build after updating.

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
GITHUB_USER_ID="${GITHUB_USER_ID:-12745166}"
GITHUB_USERNAME="${GITHUB_USERNAME:-muhajirdev}"
REPO_ID="${GITHUB_REPO_ID:-1334749004}"
REPO_NAME="${GITHUB_REPO_NAME:-groxbot}"
PRODUCTION_BRANCH="${WORKERS_BUILDS_BRANCH:-main}"
BUILD_COMMAND="corepack enable && corepack pnpm install --frozen-lockfile"

if [[ -z "${ACCOUNT_ID}" ]]; then
  ACCOUNT_ID="$(python3 - <<'PY'
import pathlib, re
text = pathlib.Path("apps/api/wrangler.jsonc").read_text()
match = re.search(r'"account_id"\s*:\s*"([^"]+)"', text)
print(match.group(1) if match else "")
PY
)"
fi

if [[ -z "${ACCOUNT_ID}" ]]; then
  echo "Set CLOUDFLARE_ACCOUNT_ID" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  WRANGLER_CONFIG="${HOME}/.wrangler/config/default.toml"
  if [[ -f "${WRANGLER_CONFIG}" ]]; then
    CLOUDFLARE_API_TOKEN="$(python3 - <<'PY'
import tomllib, pathlib
path = pathlib.Path.home() / ".wrangler/config/default.toml"
data = tomllib.loads(path.read_text())
print(data.get("oauth_token", ""))
PY
)"
  fi
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Set CLOUDFLARE_API_TOKEN (Workers Builds Configuration: Edit) or run: wrangler login" >&2
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

declare -A WORKER_TAGS=(
  ["groxbot-api"]="1fd37c5f076445c3a7770110d11af994"
  ["groxbot-web"]="e20e26171c3745fcac819ca0f694b751"
  ["groxbot-landing"]="a610c3aa604a47df88827519a6941794"
)

declare -A DEPLOY_COMMANDS=(
  ["groxbot-api"]="corepack pnpm deploy:api"
  ["groxbot-web"]="corepack pnpm deploy:web"
  ["groxbot-landing"]="corepack pnpm deploy:landing"
)

declare -A UPLOAD_COMMANDS=(
  ["groxbot-api"]="corepack pnpm upload:api"
  ["groxbot-web"]="corepack pnpm upload:web"
  ["groxbot-landing"]="corepack pnpm upload:landing"
)

declare -A PATH_INCLUDES=(
  ["groxbot-api"]='["apps/api/**","packages/**","pnpm-lock.yaml","pnpm-workspace.yaml","package.json","turbo.json"]'
  ["groxbot-web"]='["apps/web/**","packages/**","pnpm-lock.yaml","pnpm-workspace.yaml","package.json","turbo.json"]'
  ["groxbot-landing"]='["apps/landing/**","packages/**","pnpm-lock.yaml","pnpm-workspace.yaml","package.json","turbo.json"]'
)

upsert_trigger() {
  local worker="$1"
  local kind="$2"
  local existing_uuid="$3"
  local tag="${WORKER_TAGS[$worker]}"
  local trigger_name deploy_command branch_includes branch_excludes

  if [[ "${kind}" == "production" ]]; then
    trigger_name="Deploy ${PRODUCTION_BRANCH}"
    deploy_command="${DEPLOY_COMMANDS[$worker]}"
    branch_includes="[\"${PRODUCTION_BRANCH}\"]"
    branch_excludes="[]"
  else
    trigger_name="Deploy non-production branches"
    deploy_command="${UPLOAD_COMMANDS[$worker]}"
    branch_includes='["*"]'
    branch_excludes="[\"${PRODUCTION_BRANCH}\"]"
  fi

  local payload
  payload="$(cat <<JSON
{
  "external_script_id": "${tag}",
  "repo_connection_uuid": "${REPO_CONNECTION_UUID}",
  "build_token_uuid": "${BUILD_TOKEN_UUID}",
  "trigger_name": "${trigger_name}",
  "build_command": "${BUILD_COMMAND}",
  "deploy_command": "${deploy_command}",
  "root_directory": "/",
  "branch_includes": ${branch_includes},
  "branch_excludes": ${branch_excludes},
  "path_includes": ${PATH_INCLUDES[$worker]},
  "path_excludes": [],
  "build_caching_enabled": true
}
JSON
)"

  local response
  if [[ -n "${existing_uuid}" ]]; then
    echo "  updating ${kind} trigger ${existing_uuid}" >&2
    response="$(api PATCH "/accounts/${ACCOUNT_ID}/builds/triggers/${existing_uuid}" "${payload}")"
  else
    echo "  creating ${kind} trigger" >&2
    response="$(api POST "/accounts/${ACCOUNT_ID}/builds/triggers" "${payload}")"
  fi
  local result
  result="$(require_success "${worker} ${kind} trigger" "${response}")"
  python3 - <<'PY' "${result}"
import json, sys
result = json.loads(sys.argv[1])
print(result.get("trigger_uuid") or result.get("uuid") or "")
PY
}

for worker in groxbot-api groxbot-web groxbot-landing; do
  tag="${WORKER_TAGS[$worker]}"
  echo "==> Configuring ${worker} (${tag})"

  EXISTING="$(api GET "/accounts/${ACCOUNT_ID}/builds/workers/${tag}/triggers")"
  read -r PROD_UUID PREVIEW_UUID < <(python3 - <<'PY' "${EXISTING}" "${PRODUCTION_BRANCH}"
import json, sys
data = json.loads(sys.argv[1])
prod_branch = sys.argv[2]
prod_uuid = ""
preview_uuid = ""
if data.get("success"):
    for trigger in data.get("result") or []:
        branches = trigger.get("branch_includes") or []
        uuid = trigger.get("trigger_uuid", "")
        if prod_branch in branches and "*" not in branches:
            prod_uuid = uuid
        elif "*" in branches:
            preview_uuid = uuid
print(prod_uuid, preview_uuid)
PY
)

  PROD_TRIGGER_UUID="$(upsert_trigger "${worker}" production "${PROD_UUID}")"
  echo "  production trigger_uuid=${PROD_TRIGGER_UUID}"
  PREVIEW_TRIGGER_UUID="$(upsert_trigger "${worker}" preview "${PREVIEW_UUID}")"
  echo "  preview trigger_uuid=${PREVIEW_TRIGGER_UUID}"

  if [[ "${WORKERS_BUILDS_TRIGGER_BUILD:-}" == "1" ]]; then
    echo "  triggering production build on ${PRODUCTION_BRANCH}"
    BUILD_RESPONSE="$(api POST "/accounts/${ACCOUNT_ID}/builds/triggers/${PROD_TRIGGER_UUID}/builds" "{\"branch\":\"${PRODUCTION_BRANCH}\"}")"
    require_success "${worker} production build" "${BUILD_RESPONSE}" >/dev/null
  fi
done

echo "Done. Push to ${PRODUCTION_BRANCH} runs pnpm deploy:*. Other branches run pnpm upload:*."
