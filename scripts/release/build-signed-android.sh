#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
output_dir=${SIGNED_OUTPUT_DIR:-"$repo_root/build/release"}
temp_parent=${RUNNER_TEMP:-/private/tmp}
temp_dir=$(mktemp -d "$temp_parent/murmur-android-signing.XXXXXX")

cleanup() {
  unset MURMUR_ANDROID_KEYSTORE_PATH MURMUR_ANDROID_KEYSTORE_PASSWORD MURMUR_ANDROID_KEY_ALIAS MURMUR_ANDROID_KEY_PASSWORD MURMUR_REQUIRE_RELEASE_SIGNING
  if [[ -d "$temp_dir" && ! -L "$temp_dir" && $(basename "$temp_dir") == murmur-android-signing.* ]]; then
    find "$temp_dir" -depth -delete
  fi
}

trap cleanup EXIT HUP INT TERM

command -v op >/dev/null
command -v jq >/dev/null
command -v keytool >/dev/null
command -v jarsigner >/dev/null

chmod 700 "$temp_dir"
manifest="$repo_root/release/manifest.json"
expected_keystore_sha256=$(jq -er '.android.keystore_sha256' "$manifest")
expected_certificate_sha256=$(jq -er '.android.certificate_sha256' "$manifest")

bash "$repo_root/scripts/release/restore-signing-assets.sh" android "$temp_dir/assets"
export MURMUR_ANDROID_KEYSTORE_PATH="$temp_dir/assets/upload.keystore"
export MURMUR_ANDROID_KEYSTORE_PASSWORD
MURMUR_ANDROID_KEYSTORE_PASSWORD=$(<"$temp_dir/assets/store.password")
export MURMUR_ANDROID_KEY_ALIAS
MURMUR_ANDROID_KEY_ALIAS=$(<"$temp_dir/assets/key.alias")
export MURMUR_ANDROID_KEY_PASSWORD
MURMUR_ANDROID_KEY_PASSWORD=$(<"$temp_dir/assets/key.password")
export MURMUR_REQUIRE_RELEASE_SIGNING=true

actual_keystore_sha256=$(shasum -a 256 "$MURMUR_ANDROID_KEYSTORE_PATH" | awk '{print $1}')
keytool -J-Djava.security.egd=file:/dev/urandom -list -keystore "$MURMUR_ANDROID_KEYSTORE_PATH" -storepass:env MURMUR_ANDROID_KEYSTORE_PASSWORD -alias "$MURMUR_ANDROID_KEY_ALIAS" -keypass:env MURMUR_ANDROID_KEY_PASSWORD -v > "$temp_dir/keytool.txt"
actual_certificate_sha256=$(awk '/SHA256:/{sub(/^[[:space:]]*SHA256: /, ""); print; exit}' "$temp_dir/keytool.txt")

if [[ "$actual_keystore_sha256" != "$expected_keystore_sha256" || "$actual_certificate_sha256" != "$expected_certificate_sha256" ]]; then
  echo "The recovered Murmur Android upload key does not match the release manifest." >&2
  exit 1
fi

cd "$repo_root/apps/mobile"
export EXPO_PUBLIC_MURMUR_WORKER_URL=https://murmur.q9labs.ai
pnpm exec expo prebuild --clean --no-install --platform android
echo "Building the signed Murmur Android bundle."
./gradlew --no-daemon testDebugUnitTest bundleRelease

built_bundle="$repo_root/apps/mobile/android/app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$built_bundle" ]]; then
  echo "Gradle completed without producing the expected Murmur release bundle." >&2
  exit 1
fi

jarsigner -verify "$built_bundle" >/dev/null
bundle_certificate_sha256=$(keytool -printcert -jarfile "$built_bundle" 2>/dev/null | awk '/SHA256:/{sub(/^[[:space:]]*SHA256: /, ""); print; exit}')
if [[ "$bundle_certificate_sha256" != "$expected_certificate_sha256" ]]; then
  echo "The built Murmur Android bundle was signed with an unexpected certificate." >&2
  exit 1
fi

mkdir -p "$output_dir"
cp "$built_bundle" "$output_dir/murmur-android-signed.aab"
printf 'android_bundle=%s\n' "$output_dir/murmur-android-signed.aab"
printf 'keystore_sha256=%s\n' "$actual_keystore_sha256"
printf 'certificate_sha256=%s\n' "$bundle_certificate_sha256"
