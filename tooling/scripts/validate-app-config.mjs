#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const readProjectFile = (...pathParts) => readFileSync(join(mobileRoot, ...pathParts), "utf8");
const appConfig = JSON.parse(readProjectFile("app.json")).expo;
const easConfig = JSON.parse(readProjectFile("eas.json"));
const appUiSourceFiles = [
  ["app", "index.tsx"],
  ["src", "home", "bottomDock.tsx"],
  ["src", "home", "onboarding.tsx"],
  ["src", "home", "translationSurface.tsx"],
];
const appUiSource = appUiSourceFiles.map((pathParts) => readProjectFile(...pathParts)).join("\n");
const failures = [];

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const productionWorkerUrl = "https://murmur.q9labs.ai";
const requiredPrivacyTypes = [
  "NSPrivacyCollectedDataTypeAudioData",
  "NSPrivacyCollectedDataTypeOtherUserContent",
  "NSPrivacyCollectedDataTypeOtherDiagnosticData",
  "NSPrivacyCollectedDataTypePerformanceData",
  "NSPrivacyCollectedDataTypeProductInteraction",
  "NSPrivacyCollectedDataTypeDeviceID",
  "NSPrivacyCollectedDataTypeEmailAddress",
  "NSPrivacyCollectedDataTypeUserID",
  "NSPrivacyCollectedDataTypePurchaseHistory",
];
const linkedPrivacyTypes = new Set([
  "NSPrivacyCollectedDataTypeAudioData",
  "NSPrivacyCollectedDataTypeOtherUserContent",
  "NSPrivacyCollectedDataTypeEmailAddress",
  "NSPrivacyCollectedDataTypeUserID",
  "NSPrivacyCollectedDataTypePurchaseHistory",
]);

assert(appConfig.name === "Murmur", `app name must be Murmur; got ${appConfig.name}`);
assert(appConfig.owner === "q9labs", `Expo owner must be q9labs; got ${appConfig.owner}`);
assert(appConfig.slug === "murmur", `Expo slug must be murmur; got ${appConfig.slug}`);
assert(appConfig.version === "1.2.2", `app version must be 1.2.2 for this release; got ${appConfig.version}`);
assert(appConfig.orientation === "portrait", `orientation must be portrait; got ${appConfig.orientation}`);
assert(appConfig.scheme === "murmur", `scheme must be murmur; got ${appConfig.scheme}`);
assert(appConfig.icon === "./assets/images/icon.png", "app icon path must use the validated icon asset");
assert(appConfig.splash?.image === "./assets/images/splash-icon.png", "splash image must use the validated splash asset");
assert(appConfig.splash?.backgroundColor === "#F8F4ED", "splash background must match the validated launch asset");

assert(appConfig.ios?.bundleIdentifier === "com.q9labsai.murmur", "iOS bundle id must be com.q9labsai.murmur");
assert(appConfig.ios?.buildNumber === "13", `iOS build number must be 13 for the v1.2.2 testing release; got ${appConfig.ios?.buildNumber}`);
assert(
  appConfig.ios?.appStoreUrl === "https://apps.apple.com/app/id6756962206",
  "iOS store URL must target Murmur's App Store listing",
);
assert(appConfig.ios?.supportsTablet === false, "iPad support must stay disabled until iPad screenshots/device proof exist");
assert(
  appConfig.ios?.infoPlist?.NSMicrophoneUsageDescription ===
    "Murmur needs microphone access to stream speech for live translation.",
  "iOS microphone permission copy must match the store packet",
);
assert(
  JSON.stringify(appConfig.ios?.infoPlist?.UIBackgroundModes ?? []) === JSON.stringify(["audio"]),
  "iOS background modes must only include audio for live translation capture",
);
assert(appConfig.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false, "iOS export compliance flag must be false");
const appAttestEnvironment = appConfig.ios?.entitlements?.["com.apple.developer.devicecheck.appattest-environment"];
assert(
  appAttestEnvironment === undefined || appAttestEnvironment === "production",
  "iOS App Attest entitlement must be omitted for App Store signing or use production environment",
);

const privacyManifest = appConfig.ios?.privacyManifests;
assert(privacyManifest?.NSPrivacyTracking === false, "iOS privacy manifest must declare no tracking");
assert(Array.isArray(privacyManifest?.NSPrivacyTrackingDomains), "iOS privacy manifest tracking domains must be an array");
assert(privacyManifest?.NSPrivacyTrackingDomains?.length === 0, "iOS privacy manifest must have no tracking domains");
const privacyTypes = new Set(
  privacyManifest?.NSPrivacyCollectedDataTypes?.map((entry) => entry.NSPrivacyCollectedDataType) ?? [],
);
for (const privacyType of requiredPrivacyTypes) {
  assert(privacyTypes.has(privacyType), `iOS privacy manifest missing ${privacyType}`);
}
for (const entry of privacyManifest?.NSPrivacyCollectedDataTypes ?? []) {
  assert(
    entry.NSPrivacyCollectedDataTypeLinked === linkedPrivacyTypes.has(entry.NSPrivacyCollectedDataType),
    `${entry.NSPrivacyCollectedDataType} has an incorrect account-linking declaration`,
  );
  assert(entry.NSPrivacyCollectedDataTypeTracking === false, `${entry.NSPrivacyCollectedDataType} must not be used for tracking`);
}

const deviceIdPrivacyEntry = privacyManifest?.NSPrivacyCollectedDataTypes?.find(
  (entry) => entry.NSPrivacyCollectedDataType === "NSPrivacyCollectedDataTypeDeviceID",
);
assert(
  deviceIdPrivacyEntry?.NSPrivacyCollectedDataTypePurposes?.includes(
    "NSPrivacyCollectedDataTypePurposeAnalytics",
  ),
  "DeviceID privacy declaration must include analytics for pseudonymous session measurement",
);

assert(appConfig.android?.package === "com.q9labsai.murmur", "Android package must be com.q9labsai.murmur");
assert(
  appConfig.android?.playStoreUrl ===
    "https://play.google.com/store/apps/details?id=com.q9labsai.murmur",
  "Android store URL must target Murmur's Google Play listing",
);
assert(appConfig.android?.versionCode === 7, `Android versionCode must be 7 for the v1.2.2 testing release; got ${appConfig.android?.versionCode}`);
assert(appConfig.android?.adaptiveIcon?.foregroundImage === "./assets/images/adaptive-icon.png", "Android adaptive icon must use validated asset");
assert(appConfig.android?.adaptiveIcon?.backgroundColor === "#F8F4ED", "Android adaptive icon background must match generated icon");
const requiredAndroidPermissions = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
  "android.permission.RECORD_AUDIO",
];
assert(
  JSON.stringify(appConfig.android?.permissions ?? []) === JSON.stringify(requiredAndroidPermissions),
  "Android explicit permissions must only include foreground microphone capture permissions",
);
const blockedPermissions = new Set(appConfig.android?.blockedPermissions ?? []);
for (const blockedPermission of [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.USE_BIOMETRIC",
  "android.permission.USE_FINGERPRINT",
  "android.permission.VIBRATE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
]) {
  assert(blockedPermissions.has(blockedPermission), `Android blockedPermissions missing ${blockedPermission}`);
}

assert(appConfig.plugins?.includes("./plugins/withAndroidReleaseSigning"), "Android release-signing config plugin must be registered");
assert(appConfig.plugins?.includes("expo-secure-store"), "expo-secure-store plugin must be registered");
assert(appConfig.extra?.eas?.projectId === "7fc2e2d0-1f74-404f-b8e0-7d80a84681c6", "EAS project id must stay linked");
assert(!appUiSource.includes("Start Listening"), "First-session CTA must use canonical Listen copy, not Start Listening");
assert(appUiSource.includes(">Listen<"), "App UI must include the canonical Listen CTA");

const productionBuild = easConfig.build?.production;
const testingBuild = easConfig.build?.testing;
assert(testingBuild?.distribution === "store", "EAS testing build must use store distribution");
assert(testingBuild?.android?.buildType === "app-bundle", "EAS testing Android build must produce an app bundle");
assert(testingBuild?.ios?.simulator === false, "EAS testing iOS build must target devices, not simulator");
assert(testingBuild?.env?.EXPO_PUBLIC_MURMUR_WORKER_URL === productionWorkerUrl, "EAS store testing Worker URL must target the production Worker");
assert(productionBuild?.distribution === "store", "EAS production build must use store distribution");
assert(productionBuild?.android?.buildType === "app-bundle", "EAS production Android build must produce an app bundle");
assert(productionBuild?.ios?.simulator === false, "EAS production iOS build must target devices, not simulator");
assert(productionBuild?.env?.EXPO_PUBLIC_MURMUR_WORKER_URL === productionWorkerUrl, "EAS production Worker URL must target production Worker");
assert(easConfig.submit?.production?.android?.track === "production", "EAS Android submit track should target production for this release");

if (failures.length > 0) {
  console.error("App config validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("App config validation passed.");
