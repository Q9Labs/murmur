#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE_ROOT="$ROOT_DIR/apps/mobile"
PROPERTIES_FILE="${MURMUR_ANDROID_KEYSTORE_PROPERTIES:-"$HOME/.murmur/android-upload-keystore.properties"}"

"$ROOT_DIR/tooling/scripts/check-android-release-signing.sh"

if [[ ! -f "$PROPERTIES_FILE" ]]; then
  echo "Missing Android signing properties: $PROPERTIES_FILE" >&2
  echo "Expected keys: MURMUR_ANDROID_KEYSTORE_PATH, MURMUR_ANDROID_KEYSTORE_PASSWORD, MURMUR_ANDROID_KEY_ALIAS, MURMUR_ANDROID_KEY_PASSWORD" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$PROPERTIES_FILE"
set +a

export MURMUR_REQUIRE_RELEASE_SIGNING=true
export NODE_ENV="${NODE_ENV:-production}"

cd "$MOBILE_ROOT/android"
./gradlew :app:assembleRelease :app:bundleRelease
