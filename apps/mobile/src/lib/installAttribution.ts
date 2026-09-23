import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import { Platform } from "react-native";

import MurmurAudioModule from "../../modules/murmur-audio";
import { getOrCreateInstallId } from "./installIdentity";
import { getLocalValue, setLocalValue } from "./localStorage";
import { deliverInstallAttribution } from "./providers/insightsWorker";

const attributionRecordedKey = "murmur_install_attribution_recorded_v1";

export async function captureInstallAttribution(): Promise<void> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  if ((await getLocalValue(attributionRecordedKey)) === "true") return;
  try {
    const appInstallId = await getOrCreateInstallId();
    const attribution = Platform.OS === "android"
      ? { platform: "android" as const, referrer: await Application.getInstallReferrerAsync() }
      : { platform: "ios" as const, token: await MurmurAudioModule.getAdServicesAttributionToken() };
    await deliverInstallAttribution({ app_install_id: appInstallId, ...attribution });
    await setLocalValue(attributionRecordedKey, "true");
  } catch (failure) {
    Sentry.captureException(failure, { tags: { operation: "capture_install_attribution" } });
  }
}
