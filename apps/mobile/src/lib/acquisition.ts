import * as Linking from "expo-linking";

import {
  normalizeAcquisitionContext,
  type AcquisitionContext,
} from "@murmur/protocol/acquisition";

const landingByPath: Record<string, string> = {
  "arabic-to-english-live-captions": "arabic-english",
  "english-to-arabic-live-captions": "english-arabic",
  "live-translation-for-talks": "talks",
  "live-translation-for-travel": "travel",
  "phrase-mode-vs-continuous-mode": "modes",
};

export function getAcquisitionContextFromUrl(url: string | null): AcquisitionContext | undefined {
  if (!url) {
    return undefined;
  }

  const parsed = Linking.parse(url);
  return getAcquisitionContextFromQuery(parsed.queryParams ?? {}, parsed.path ?? undefined);
}

export function getAcquisitionContextFromQuery(
  query: Record<string, unknown>,
  path?: string,
): AcquisitionContext | undefined {
  return normalizeAcquisitionContext({
    campaign: query.utm_campaign ?? query.campaign,
    content: query.utm_content ?? query.content,
    landing: query.landing ?? (path ? landingByPath[trimPath(path)] : undefined),
    medium: query.utm_medium ?? query.medium,
    partner: query.partner,
    source: query.utm_source ?? query.source,
  });
}

function trimPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}
