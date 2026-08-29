#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
output_dir=${SIGNED_OUTPUT_DIR:-"$repo_root/build/release"}
temp_parent=${RUNNER_TEMP:-/private/tmp}
temp_dir=$(mktemp -d "$temp_parent/murmur-ios-signing.XXXXXX")
keychain_path="$temp_dir/release.keychain-db"
installed_profile="$HOME/Library/MobileDevice/Provisioning Profiles/f287c919-1cc0-45a9-b5d8-7aa80ee4160e.mobileprovision"
profile_was_present=false
original_keychains=()

while IFS= read -r keychain; do
  keychain=${keychain#*\"}
  keychain=${keychain%\"*}
  [[ -n "$keychain" ]] && original_keychains+=("$keychain")
done < <(security list-keychains -d user)

cleanup() {
  unset MURMUR_IOS_P12_PASSWORD

  if ((${#original_keychains[@]})); then
    security list-keychains -d user -s "${original_keychains[@]}" >/dev/null 2>&1 || true
  fi

  security delete-keychain "$keychain_path" >/dev/null 2>&1 || true

  if [[ "$profile_was_present" == true ]]; then
    if [[ -f "$temp_dir/original-profile.mobileprovision" && ! -L "$installed_profile" ]]; then
      cp "$temp_dir/original-profile.mobileprovision" "$installed_profile"
    fi
  elif [[ -f "$installed_profile" && ! -L "$installed_profile" ]]; then
    find "$installed_profile" -delete
  fi

  if [[ -d "$temp_dir" && ! -L "$temp_dir" && $(basename "$temp_dir") == murmur-ios-signing.* ]]; then
    find "$temp_dir" -depth -delete
  fi
}

trap cleanup EXIT HUP INT TERM

command -v op >/dev/null
command -v jq >/dev/null
command -v security >/dev/null
command -v xcodebuild >/dev/null
command -v codesign >/dev/null
command -v openssl >/dev/null
command -v plutil >/dev/null

chmod 700 "$temp_dir"
manifest="$repo_root/release/manifest.json"
expected_certificate_sha256=$(jq -er '.apple.certificate_sha256' "$manifest")
expected_profile_name=$(jq -er '.apple.profile_name' "$manifest")
expected_profile_uuid=$(jq -er '.apple.profile_uuid' "$manifest")
expected_profile_sha256=$(jq -er '.apple.profile_sha256' "$manifest")
expected_team_id=$(jq -er '.apple.team_id' "$manifest")
expected_bundle_id=$(jq -er '.apple.bundle_id' "$manifest")

echo "Recovering Murmur Apple release credentials from 1Password."
bash "$repo_root/scripts/release/restore-signing-assets.sh" ios "$temp_dir/assets"

export MURMUR_IOS_P12_PASSWORD
MURMUR_IOS_P12_PASSWORD=$(<"$temp_dir/assets/p12.password")
openssl pkcs12 -legacy -in "$temp_dir/assets/distribution.p12" -nokeys -passin env:MURMUR_IOS_P12_PASSWORD 2>/dev/null |
  openssl x509 -outform der -out "$temp_dir/distribution.cer"
certificate_sha256=$(openssl x509 -inform der -in "$temp_dir/distribution.cer" -noout -fingerprint -sha256 | cut -d= -f2)

security cms -D -i "$temp_dir/assets/profile.mobileprovision" > "$temp_dir/profile.plist"
profile_name=$(plutil -extract Name raw -o - "$temp_dir/profile.plist")
profile_uuid=$(plutil -extract UUID raw -o - "$temp_dir/profile.plist")
profile_app_id=$(plutil -extract Entitlements.application-identifier raw -o - "$temp_dir/profile.plist")
profile_sha256=$(shasum -a 256 "$temp_dir/assets/profile.mobileprovision" | awk '{print $1}')
plutil -extract DeveloperCertificates.0 raw -o - "$temp_dir/profile.plist" | base64 --decode > "$temp_dir/profile.cer"
profile_certificate_sha256=$(openssl x509 -inform der -in "$temp_dir/profile.cer" -noout -fingerprint -sha256 | cut -d= -f2)

if [[ "$certificate_sha256" != "$expected_certificate_sha256" || "$profile_certificate_sha256" != "$expected_certificate_sha256" ]]; then
  echo "The recovered Apple distribution certificate does not match the Murmur provisioning profile or release manifest." >&2
  exit 1
fi

if [[ "$profile_name" != "$expected_profile_name" || "$profile_uuid" != "$expected_profile_uuid" || "$profile_app_id" != "$expected_team_id.$expected_bundle_id" || "$profile_sha256" != "$expected_profile_sha256" ]]; then
  echo "The recovered Murmur provisioning profile does not match the release manifest." >&2
  exit 1
fi

echo "Verifying the Murmur Apple release identity."
keychain_password=$(openssl rand -hex 24)
security create-keychain -p "$keychain_password" "$keychain_path"
security set-keychain-settings -lut 21600 "$keychain_path"
security unlock-keychain -p "$keychain_password" "$keychain_path"
security import "$temp_dir/assets/distribution.p12" -k "$keychain_path" -P "$MURMUR_IOS_P12_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain_path" >/dev/null
security list-keychains -d user -s "$keychain_path" "${original_keychains[@]}"

mkdir -p "$(dirname "$installed_profile")"
if [[ -f "$installed_profile" ]]; then
  profile_was_present=true
  cp "$installed_profile" "$temp_dir/original-profile.mobileprovision"
fi
cp "$temp_dir/assets/profile.mobileprovision" "$installed_profile"

cd "$repo_root/apps/mobile"
export EXPO_PUBLIC_MURMUR_WORKER_URL=https://murmur.q9labs.ai
pnpm exec expo prebuild --clean --no-install --platform ios
if command -v pod >/dev/null; then
  pod install --project-directory=ios
fi

archive_path="$temp_dir/Murmur.xcarchive"
export_path="$temp_dir/export"
echo "Building the signed Murmur iOS archive."
if ! xcodebuild \
  -workspace ios/Murmur.xcworkspace \
  -scheme Murmur \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath "$archive_path" \
  DEVELOPMENT_TEAM="$expected_team_id" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="$expected_profile_name" \
  archive > "$temp_dir/archive.log" 2>&1; then
  rg -n 'error:|ARCHIVE FAILED' "$temp_dir/archive.log" | tail -80 >&2 || true
  tail -120 "$temp_dir/archive.log" >&2
  exit 1
fi

cat > "$temp_dir/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>export</string>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>teamID</key>
  <string>$expected_team_id</string>
  <key>uploadSymbols</key>
  <false/>
  <key>provisioningProfiles</key>
  <dict>
    <key>$expected_bundle_id</key>
    <string>$expected_profile_name</string>
  </dict>
</dict>
</plist>
PLIST

if ! xcodebuild -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$export_path" \
  -exportOptionsPlist "$temp_dir/ExportOptions.plist" > "$temp_dir/export.log" 2>&1; then
  rg -n 'error:|EXPORT FAILED' "$temp_dir/export.log" | tail -80 >&2 || true
  tail -120 "$temp_dir/export.log" >&2
  exit 1
fi

built_ipa=$(find "$export_path" -maxdepth 1 -type f -name '*.ipa' -print -quit)
if [[ -z "$built_ipa" ]]; then
  echo "Xcode completed without producing a Murmur IPA." >&2
  exit 1
fi

mkdir -p "$temp_dir/extracted"
unzip -q "$built_ipa" -d "$temp_dir/extracted"
signed_app=$(find "$temp_dir/extracted/Payload" -maxdepth 1 -type d -name '*.app' -print -quit)
codesign --verify --deep --strict "$signed_app"
codesign -d --extract-certificates="$temp_dir/signed-cert-" "$signed_app" 2>/dev/null
signed_certificate_sha256=$(openssl x509 -inform der -in "$temp_dir/signed-cert-0" -noout -fingerprint -sha256 | cut -d= -f2)
if [[ "$signed_certificate_sha256" != "$expected_certificate_sha256" ]]; then
  echo "The built Murmur iOS app was signed with an unexpected certificate." >&2
  exit 1
fi

mkdir -p "$output_dir"
cp "$built_ipa" "$output_dir/murmur-ios-signed.ipa"
ditto -c -k --keepParent "$archive_path/dSYMs" "$output_dir/murmur-ios-dsyms.zip"

printf 'ios_ipa=%s\n' "$output_dir/murmur-ios-signed.ipa"
printf 'ios_dsyms=%s\n' "$output_dir/murmur-ios-dsyms.zip"
printf 'certificate_sha256=%s\n' "$signed_certificate_sha256"
