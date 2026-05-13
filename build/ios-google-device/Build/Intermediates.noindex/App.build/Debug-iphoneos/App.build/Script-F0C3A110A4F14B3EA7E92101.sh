#!/bin/sh
PROJECT_ROOT="${SRCROOT}/../.."
NODE_EXECUTABLE="$(${PROJECT_ROOT}/scripts/find-node-for-xcode.sh "${PROJECT_ROOT}")"
"${NODE_EXECUTABLE}" "${PROJECT_ROOT}/scripts/verify-ios-web-assets.mjs" --target-built-assets "${TARGET_BUILD_DIR}/${CONTENTS_FOLDER_PATH}/public/assets" --skip-generated-build-scan

