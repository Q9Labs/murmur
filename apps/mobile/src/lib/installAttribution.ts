import * as Application from "expo-application";
import { Platform } from "react-native";

import MurmurAudioModule from "../../modules/murmur-audio";
import { getOrCreateInstallId } from "./installIdentity";
import { getLocalValue, setLocalValue } from "./localStorage";
import { captureMobileFailure, type MobileFailureContext } from "./observability/sentry";
import { deliverInstallAttribution } from "./providers/insightsWorker";

const attributionRecordedKey = "murmur_install_attribution_recorded_v1";

export async function captureInstallAttribution(isAnalyticsEnabled: () => boolean): Promise<void> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  if (!isAnalyticsEnabled()) return;
  if ((await getLocalValue(attributionRecordedKey)) === "true") return;
  let step: NonNullable<MobileFailureContext["install_attribution"]>["step"] = "install_identity";
  try {
    const appInstallId = await getOrCreateInstallId();
    step = Platform.OS === "android" ? "android_referrer" : "ios_token";
    const attribution = Platform.OS === "android"
      ? { platform: "android" as const, referrer: await Application.getInstallReferrerAsync() }
      : { platform: "ios" as const, token: await MurmurAudioModule.getAdServicesAttributionToken() };
    if (!isAnalyticsEnabled()) return;
    step = "deliver";
    await deliverInstallAttribution({ app_install_id: appInstallId, ...attribution });
    step = "record";
    await setLocalValue(attributionRecordedKey, "true");
  } catch (failure) {
    captureMobileFailure(failure, {
      operation: "capture_install_attribution",
      install_attribution: step === "android_referrer"
        ? { step, response: classifyInstallReferrerFailure(failure) }
        : { step },
    });
  }
}

function classifyInstallReferrerFailure(failure: unknown): Extract<
  NonNullable<MobileFailureContext["install_attribution"]>, { step: "android_referrer" }
>["response"] {
  if (!(failure instanceof Error) || !("code" in failure)) return "unknown";
  switch (failure.code) {
    case "ERR_APPLICATION_INSTALL_REFERRER_UNAVAILABLE":
      return "feature_not_supported";
    case "ERR_APPLICATION_INSTALL_REFERRER_SERVICE_DISCONNECTED":
      return "service_disconnected";
    case "ERR_APPLICATION_INSTALL_REFERRER_REMOTE_EXCEPTION":
      return "remote_exception";
    case "ERR_APPLICATION_INSTALL_REFERRER":
      // Expo 57.0.3 exposes the response only in these fixed messages, not a structured field.
      switch (failure.message) {
        case "General error retrieving the install referrer: response code 1":
          return "service_unavailable";
        case "General error retrieving the install referrer: response code 3":
          return "developer_error";
        default:
          return "unknown";
      }
    default:
      return "unknown";
  }
}
