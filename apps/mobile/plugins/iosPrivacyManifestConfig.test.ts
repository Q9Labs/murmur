import appConfig from "../app.json";
import { describe, expect, it } from "vitest";

const privacyManifests = appConfig.expo.ios.privacyManifests;

describe("iOS privacy manifest config", () => {
  it("declares Murmur's non-tracking App Privacy data categories in tracked config", () => {
    expect(privacyManifests.NSPrivacyTracking).toBe(false);
    expect(privacyManifests.NSPrivacyTrackingDomains).toEqual([]);

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
