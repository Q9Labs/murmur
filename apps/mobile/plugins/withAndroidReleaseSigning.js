const { createRunOncePlugin, withAppBuildGradle } = require("expo/config-plugins");

const pkg = require("../package.json");

const helperBlock = `// @murmur-release-signing-start
def releaseSigningValue(String name) {
    return System.getenv(name) ?: project.findProperty(name)
}

def releaseKeystorePath = releaseSigningValue("MURMUR_ANDROID_KEYSTORE_PATH")
def releaseKeystorePassword = releaseSigningValue("MURMUR_ANDROID_KEYSTORE_PASSWORD")
def releaseKeyAlias = releaseSigningValue("MURMUR_ANDROID_KEY_ALIAS")
def releaseKeyPassword = releaseSigningValue("MURMUR_ANDROID_KEY_PASSWORD")
def hasReleaseSigning = releaseKeystorePath && releaseKeystorePassword && releaseKeyAlias && releaseKeyPassword
def requireReleaseSigning = (releaseSigningValue("MURMUR_REQUIRE_RELEASE_SIGNING") ?: "false").toBoolean()
// @murmur-release-signing-end

`;

const releaseSigningConfig = `        release {
            if (hasReleaseSigning) {
                storeFile file(releaseKeystorePath)
                storePassword releaseKeystorePassword
                keyAlias releaseKeyAlias
                keyPassword releaseKeyPassword
            }
        }`;

const releaseBuildSigningBlock = `            if (hasReleaseSigning) {
                signingConfig signingConfigs.release
            } else {
                if (requireReleaseSigning) {
                    throw new GradleException("Missing Android release signing credentials. Set MURMUR_ANDROID_KEYSTORE_PATH, MURMUR_ANDROID_KEYSTORE_PASSWORD, MURMUR_ANDROID_KEY_ALIAS, and MURMUR_ANDROID_KEY_PASSWORD.")
                }
                signingConfig signingConfigs.debug
            }`;

function addReleaseSigning(source) {
  if (source.includes("MURMUR_ANDROID_KEYSTORE_PATH")) {
    return source;
  }

  let foundAndroidBlock = false;
  let next = source.replace(/(^|\n)android\s*\{/, (match, prefix) => {
    foundAndroidBlock = true;
    return `${prefix}${helperBlock}android {`;
  });
  if (!foundAndroidBlock) {
    throw new Error("Unable to find android block in android/app/build.gradle");
  }

  next = next.replace(
    /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\})/,
    `$1\n${releaseSigningConfig}`,
  );
  if (!next.includes("storeFile file(releaseKeystorePath)")) {
    throw new Error("Unable to inject Android release signing config");
  }

  next = next.replace(
    /(release\s*\{[\s\S]*?)^\s*signingConfig signingConfigs\.debug\s*$/m,
    `$1${releaseBuildSigningBlock}`,
  );
  if (!next.includes("Missing Android release signing credentials")) {
    throw new Error("Unable to inject Android release signing requirement");
  }

  return next;
}

const withAndroidReleaseSigning = (config) =>
  withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addReleaseSigning(mod.modResults.contents);
    return mod;
  });

module.exports = createRunOncePlugin(
  withAndroidReleaseSigning,
  "withAndroidReleaseSigning",
  pkg.version,
);
module.exports.addReleaseSigning = addReleaseSigning;
