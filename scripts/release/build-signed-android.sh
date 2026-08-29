#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
output_dir=${SIGNED_OUTPUT_DIR:-"$repo_root/build/release"}
if [[ "$output_dir" != /* ]]; then
  output_dir="$repo_root/$output_dir"
fi
temp_parent=${RUNNER_TEMP:-/private/tmp}
temp_dir=$(mktemp -d "$temp_parent/murmur-android-signing.XXXXXX")
gradle_user_home="$temp_dir/gradle-home"
artifact_name=murmur-android-signed.aab

cleanup() {
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
actual_keystore_sha256=$(shasum -a 256 "$temp_dir/assets/upload.keystore" | awk '{print $1}')
keytool -J-Djava.security.egd=file:/dev/urandom -list \
  -keystore "$temp_dir/assets/upload.keystore" \
  -storepass:file "$temp_dir/assets/store.password" \
  -alias "$(<"$temp_dir/assets/key.alias")" \
  -keypass:file "$temp_dir/assets/key.password" \
  -v > "$temp_dir/keytool.txt"
actual_certificate_sha256=$(awk '/SHA256:/{sub(/^[[:space:]]*SHA256: /, ""); print; exit}' "$temp_dir/keytool.txt")

if [[ "$actual_keystore_sha256" != "$expected_keystore_sha256" || "$actual_certificate_sha256" != "$expected_certificate_sha256" ]]; then
  echo "The recovered Murmur Android upload key does not match the release manifest." >&2
  exit 1
fi

mkdir -p "$gradle_user_home" "$output_dir"
chmod 700 "$gradle_user_home"
cat > "$gradle_user_home/gradle.properties" <<PROPERTIES
MURMUR_ANDROID_KEYSTORE_PATH=$temp_dir/assets/upload.keystore
MURMUR_ANDROID_KEYSTORE_PASSWORD_FILE=$temp_dir/assets/store.password
MURMUR_ANDROID_KEY_ALIAS=$(<"$temp_dir/assets/key.alias")
MURMUR_ANDROID_KEY_PASSWORD_FILE=$temp_dir/assets/key.password
MURMUR_REQUIRE_RELEASE_SIGNING=true
PROPERTIES
chmod 600 "$gradle_user_home/gradle.properties"

cat > "$temp_dir/release-output.init.gradle" <<'GRADLE'
import java.nio.file.Files
import java.nio.file.StandardCopyOption

gradle.projectsEvaluated {
    def outputPath = gradle.startParameter.projectProperties["q9ReleaseOutputDir"]
    def artifactName = gradle.startParameter.projectProperties["q9ReleaseArtifactName"]
    def appProject = rootProject.findProject(":app")
    if (!outputPath || !artifactName || !appProject) {
        return
    }

    appProject.tasks.matching { it.name == "bundleRelease" }.configureEach {
        doLast {
            def bundle = new File(project.buildDir, "outputs/bundle/release/app-release.aab")
            def destination = new File(outputPath, artifactName)
            destination.parentFile.mkdirs()
            Files.copy(bundle.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }
}
GRADLE

cd "$repo_root/apps/mobile"
export EXPO_PUBLIC_MURMUR_WORKER_URL=https://murmur.q9labs.ai
export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
pnpm exec expo prebuild --clean --no-install --platform android
echo "Building the signed Murmur Android bundle."
./gradlew --no-daemon --gradle-user-home "$gradle_user_home" \
  --init-script "$temp_dir/release-output.init.gradle" \
  -Pq9ReleaseOutputDir="$output_dir" \
  -Pq9ReleaseArtifactName="$artifact_name" \
  testDebugUnitTest bundleRelease

built_bundle="$output_dir/$artifact_name"
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

printf 'android_bundle=%s\n' "$output_dir/murmur-android-signed.aab"
printf 'keystore_sha256=%s\n' "$actual_keystore_sha256"
printf 'certificate_sha256=%s\n' "$bundle_certificate_sha256"
