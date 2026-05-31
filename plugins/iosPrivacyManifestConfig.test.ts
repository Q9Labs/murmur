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
      ]),
    );

    for (const entry of privacyManifests.NSPrivacyCollectedDataTypes) {
      expect(entry.NSPrivacyCollectedDataTypeLinked).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toEqual([
        "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      ]);
    }
  });
});
