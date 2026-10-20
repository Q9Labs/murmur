// cspell:ignore EUNSPECIFIED
import * as Linking from "expo-linking";

import { captureMobileFailure } from "./observability/sentry";

const legalUrls = {
  privacy: "https://murmur.q9labs.ai/privacy",
  support: "https://murmur.q9labs.ai/support",
  terms: "https://murmur.q9labs.ai/terms",
} as const;

type LegalLinkSource = "settings" | "billing";

export async function openLegalLink(target: keyof typeof legalUrls, source: LegalLinkSource): Promise<void> {
  const url = legalUrls[target];
  try {
    await Linking.openURL(url);
  } catch (failure: unknown) {
    const unspecified = failure instanceof Error && "code" in failure && failure.code === "EUNSPECIFIED";
    // Match React Native's exact fixed-URL rejection, never forward its message or an arbitrary code.
    const classification = unspecified
      ? failure.message === `Unable to open URL: ${url}` ? "native_open_rejected" : "unspecified"
      : "unknown";
    captureMobileFailure(failure, {
      error_code: unspecified ? "EUNSPECIFIED" : "external_link_unknown",
      external_link: { target, step: "open_url", failure: classification },
      operation: source === "settings" ? "open_settings_link" : "open_paywall_legal_link",
      stage: source,
    });
  }
}
