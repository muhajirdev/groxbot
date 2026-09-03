#!/usr/bin/env bash
# Activate the repo's supported Node toolchain, then exec the given command.
#
# Cloud Agent VMs put an exec-daemon Node (currently 22.14.x) at the front of
# PATH. That version is older than the engines.node floor pulled in by some
# transitive deps (>=22.18.0), so `pnpm install --frozen-lockfile` fails the
# engine-strict check. nvm already ships a compatible Node as its default, so we
# activate it (prepending it ahead of the exec-daemon shim) before running.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use default >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
  # `nvm use` only reorders PATH when nvm's bin isn't already present. The
  # exec-daemon pre-seeds its own (older) Node bin ahead of nvm's, so resolve
  # the default Node bin dir explicitly and force it to the front of PATH.
  node_bin_dir="$(dirname "$(nvm which default 2>/dev/null || command -v node)")"
  if [ -n "$node_bin_dir" ] && [ -x "$node_bin_dir/node" ]; then
    export PATH="$node_bin_dir:$PATH"
  fi
fi

corepack enable >/dev/null 2>&1 || true

exec "$@"
