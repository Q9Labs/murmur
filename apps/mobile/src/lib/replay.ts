import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";
import { Platform } from "react-native";

import { getAnonymousAnalyticsEnabled } from "./anonymousAnalytics";
import { getPostHogProjectToken } from "./config";

let client: PostHog | null = null;
const listeners = new Set<(client: PostHog | null) => void>();

function getClient(): PostHog | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version < 26) return null;
  const token = getPostHogProjectToken();
  if (!token) return null;
  client ??= new PostHog(token, {
    host: "https://us.i.posthog.com",
    captureAppLifecycleEvents: false,
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllTextInputs: true,
      maskAllImages: true,
      captureLog: false,
      captureNetworkTelemetry: false,
    },
  });
  return client;
}

export async function initializeReplay(): Promise<PostHog | null> {
  return (await getAnonymousAnalyticsEnabled()) ? getClient() : null;
}

export async function setReplayAnalyticsEnabled(enabled: boolean): Promise<void> {
  if (!enabled) {
    try {
      await client?.stopSessionRecording();
    } catch (failure) {
      Sentry.captureException(failure, { tags: { operation: "stop_session_replay" } });
    }
    await client?.optOut();
    listeners.forEach((listener) => listener(null));
    return;
  }
  const replay = getClient();
  await replay?.optIn();
  await replay?.startSessionRecording();
  listeners.forEach((listener) => listener(replay));
}

export function subscribeReplay(listener: (client: PostHog | null) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
