import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { addReleaseSigning } = require("./withAndroidReleaseSigning");

const generatedGradle = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
`;

describe("withAndroidReleaseSigning", () => {
  it("adds env-backed release signing and required-release failure guard", () => {
    const patched = addReleaseSigning(generatedGradle);

    expect(patched).toContain("MURMUR_ANDROID_KEYSTORE_PATH");
    expect(patched).toContain("MURMUR_ANDROID_KEYSTORE_PASSWORD");
    expect(patched).toContain("MURMUR_ANDROID_KEY_ALIAS");
    expect(patched).toContain("MURMUR_ANDROID_KEY_PASSWORD");
    expect(patched).toContain("MURMUR_REQUIRE_RELEASE_SIGNING");
    expect(patched).toContain(
      'getText("UTF-8").replaceFirst(/(?:\\r\\n|\\n|\\r)$/, "")',
    );
    expect(patched).not.toContain('getText("UTF-8").trim()');
    expect(patched).toContain("storeFile file(releaseKeystorePath)");
    expect(patched).toContain("signingConfig signingConfigs.release");
    expect(patched).toContain("Missing Android release signing credentials");
    expect(patched).toContain("minifyEnabled false");
    expect(patched).toMatch(
      /buildTypes\s*\{\s*debug\s*\{\s*signingConfig signingConfigs\.debug\s*\}/,
    );
    expect(patched).toMatch(
      /buildTypes[\s\S]*?release\s*\{\s*if \(hasReleaseSigning\) \{\s*signingConfig signingConfigs\.release/,
    );
  });

  it("is idempotent once the Murmur signing guard is present", () => {
    const patched = addReleaseSigning(generatedGradle);

    expect(addReleaseSigning(patched)).toBe(patched);
  });
});
