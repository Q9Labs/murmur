import appConfig from "../app.json";
import { describe, expect, it } from "vitest";

const privacyManifests = appConfig.expo.ios.privacyManifests;

describe("iOS privacy manifest config", () => {
  it("declares Murmur's non-tracking App Privacy data categories in tracked config", () => {
    expect(privacyManifests.NSPrivacyTracking).toBe(false);
    expect(privacyManifests.NSPrivacyTrackingDomains).toEqual([]);
    expect(privacyManifests.NSPrivacyAccessedAPITypes).toEqual([
      {
        NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
        NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
      },
      {
        NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
        NSPrivacyAccessedAPITypeReasons: ["C617.1"],
      },
      {
        NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
        NSPrivacyAccessedAPITypeReasons: ["E174.1"],
      },
      {
        NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
        NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
      },
    ]);

    const declaredTypes = privacyManifests.NSPrivacyCollectedDataTypes.map(
      (entry) => entry.NSPrivacyCollectedDataType,
    );

    expect(declaredTypes).toEqual(
      expect.arrayContaining([
        "NSPrivacyCollectedDataTypeAudioData",
        "NSPrivacyCollectedDataTypeOtherUserContent",
        "NSPrivacyCollectedDataTypeOtherDiagnosticData",
        "NSPrivacyCollectedDataTypePerformanceData",
        "NSPrivacyCollectedDataTypeDeviceID",
        "NSPrivacyCollectedDataTypeProductInteraction",
        "NSPrivacyCollectedDataTypeEmailAddress",
        "NSPrivacyCollectedDataTypeUserID",
        "NSPrivacyCollectedDataTypePurchaseHistory",
      ]),
    );

    const linkedTypes = new Set([
      "NSPrivacyCollectedDataTypeAudioData",
      "NSPrivacyCollectedDataTypeOtherUserContent",
      "NSPrivacyCollectedDataTypeEmailAddress",
      "NSPrivacyCollectedDataTypeUserID",
      "NSPrivacyCollectedDataTypePurchaseHistory",
    ]);

    for (const entry of privacyManifests.NSPrivacyCollectedDataTypes) {
      expect(entry.NSPrivacyCollectedDataTypeLinked).toBe(
        linkedTypes.has(entry.NSPrivacyCollectedDataType),
      );
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
    }

    const purposeByType = Object.fromEntries(
      privacyManifests.NSPrivacyCollectedDataTypes.map((entry) => [
        entry.NSPrivacyCollectedDataType,
        entry.NSPrivacyCollectedDataTypePurposes,
      ]),
    );
    expect(purposeByType.NSPrivacyCollectedDataTypeProductInteraction).toEqual([
      "NSPrivacyCollectedDataTypePurposeAnalytics",
    ]);
    expect(purposeByType.NSPrivacyCollectedDataTypeDeviceID).toEqual([
      "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      "NSPrivacyCollectedDataTypePurposeAnalytics",
    ]);
  });
});
