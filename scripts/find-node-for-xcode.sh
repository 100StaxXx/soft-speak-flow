#!/bin/sh

set -eu

PROJECT_ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"

print_candidate_and_exit() {
  candidate="$1"
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    exit 0
  fi
}

resolve_version_file() {
  if [ -f "${PROJECT_ROOT}/.nvmrc" ]; then
    printf '%s\n' "${PROJECT_ROOT}/.nvmrc"
    return 0
  fi

  if [ -f "${PROJECT_ROOT}/.node-version" ]; then
    printf '%s\n' "${PROJECT_ROOT}/.node-version"
    return 0
  fi

  return 1
}

if [ -n "${NODE_BINARY:-}" ]; then
  print_candidate_and_exit "${NODE_BINARY}"
fi

if command -v node >/dev/null 2>&1; then
  command -v node
  exit 0
fi

print_candidate_and_exit "/opt/homebrew/bin/node"
print_candidate_and_exit "/usr/local/bin/node"
print_candidate_and_exit "${HOME}/.volta/bin/node"

if version_file="$(resolve_version_file)"; then
  raw_version="$(tr -d '[:space:]' < "${version_file}")"
  if [ -n "${raw_version}" ]; then
    nvm_version="${raw_version}"
    case "${nvm_version}" in
      v*) ;;
      *) nvm_version="v${nvm_version}" ;;
    esac

    nvm_dir="${NVM_DIR:-${HOME}/.nvm}"
    print_candidate_and_exit "${nvm_dir}/versions/node/${nvm_version}/bin/node"

    plain_version="${nvm_version#v}"
    print_candidate_and_exit "${HOME}/.asdf/installs/nodejs/${plain_version}/bin/node"
    print_candidate_and_exit "${HOME}/.local/share/mise/installs/node/${plain_version}/bin/node"
    print_candidate_and_exit "${HOME}/.mise/installs/node/${plain_version}/bin/node"
  fi
fi

echo "error: Node.js is required to verify bundled web assets." >&2
echo "error: Set NODE_BINARY or install the version declared in .nvmrc/.node-version." >&2
exit 1
