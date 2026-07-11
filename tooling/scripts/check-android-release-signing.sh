#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_GRADLE="$ROOT_DIR/apps/mobile/android/app/build.gradle"

if [[ ! -f "$BUILD_GRADLE" ]]; then
  echo "Missing Android Gradle project at $BUILD_GRADLE. Run Android prebuild in apps/mobile before building a signed release." >&2
  exit 1
fi

required_patterns=(
  "MURMUR_ANDROID_KEYSTORE_PATH"
  "MURMUR_ANDROID_KEYSTORE_PASSWORD"
  "MURMUR_ANDROID_KEY_ALIAS"
  "MURMUR_ANDROID_KEY_PASSWORD"
  "MURMUR_REQUIRE_RELEASE_SIGNING"
  "Missing Android release signing credentials"
)

for pattern in "${required_patterns[@]}"; do
  if ! grep -q "$pattern" "$BUILD_GRADLE"; then
    echo "Android release signing guard is missing from apps/mobile/android/app/build.gradle: $pattern" >&2
    echo "Reapply the Murmur release-signing Gradle patch before producing a store upload artifact." >&2
    exit 1
  fi
done
