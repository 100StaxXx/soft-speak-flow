#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_FILE="$ROOT_DIR/ios/App/App/Config/LocalSecrets.xcconfig"

if [[ -f "$TARGET_FILE" ]]; then
  echo "LocalSecrets.xcconfig already exists at:"
  echo "  $TARGET_FILE"
  echo
  echo "Edit it directly if you want to replace the existing key."
  exit 0
fi

read -r -s -p "Enter WINWINKIT_IOS_API_KEY: " WINWINKIT_IOS_API_KEY
echo

if [[ -z "${WINWINKIT_IOS_API_KEY}" ]]; then
  echo "No key entered. Nothing written."
  exit 1
fi

cat > "$TARGET_FILE" <<EOF
WINWINKIT_IOS_API_KEY = ${WINWINKIT_IOS_API_KEY}
EOF

echo "Wrote $TARGET_FILE"
echo "Your iOS build can now read WinWinKitAPIKey from Info.plist."
