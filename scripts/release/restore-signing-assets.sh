#!/usr/bin/env bash

set -euo pipefail

platform=${1:-}
destination=${2:-}
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
manifest="$repo_root/release/manifest.json"

if [[ "$platform" != "android" && "$platform" != "ios" ]]; then
  echo "Usage: $0 android|ios destination-directory" >&2
  exit 2
fi

if [[ -z "$destination" ]]; then
  echo "A destination directory is required." >&2
  exit 2
fi

mkdir -p "$destination"
chmod 700 "$destination"

if [[ "$platform" == "android" ]]; then
  signing_item=$(jq -er '.android.signing_item // empty' "$manifest" 2>/dev/null || true)
  if [[ -z "$signing_item" ]]; then
    echo "Murmur Android release signing is blocked: no canonical upload keystore is available in the release vault." >&2
    echo "Restore the existing Play upload key before running a signed Android build. Do not generate a replacement without a Play Console key-rotation decision." >&2
    exit 3
  fi

  signing_ref="op://Mobile App Releases/$signing_item"
  op read --out-file "$destination/upload.keystore" "$signing_ref/keystore" >/dev/null
  op read "$signing_ref/password" > "$destination/store.password"
  op read "$signing_ref/key_password" > "$destination/key.password"
  op read "$signing_ref/key_alias" > "$destination/key.alias"
  chmod 600 "$destination/upload.keystore" "$destination/store.password" "$destination/key.password" "$destination/key.alias"
  exit 0
fi

p12_item_id=$(jq -er '.apple.p12_item_id' "$manifest")
p12_password_item_id=$(jq -er '.apple.p12_password_item_id' "$manifest")
profile_item_id=$(jq -er '.apple.profile_item_id' "$manifest")

op document get "$p12_item_id" --vault "Mobile App Releases" --output "$destination/distribution.p12" >/dev/null
op document get "$p12_password_item_id" --vault "Mobile App Releases" --output "$destination/p12.password" >/dev/null
op document get "$profile_item_id" --vault "Mobile App Releases" --output "$destination/profile.mobileprovision" >/dev/null
chmod 600 "$destination/distribution.p12" "$destination/p12.password" "$destination/profile.mobileprovision"
