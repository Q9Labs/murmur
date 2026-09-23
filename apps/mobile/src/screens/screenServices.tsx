import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useMurmurBilling } from "../lib/billing/context";
import type { ConversationHistoryEntry, ConversationHistorySummary } from "../lib/conversationHistory";
import { captureMobileFailure } from "../lib/observability/sentry";
import type { UsageSetting } from "./rating/usageChoices";

// The seam between the 1.3.0 screens and the billing, runtime, auth and insights APIs.
// Native modules load lazily so screens and previews render without them.

export type ConversationRecord = {
  canView: boolean;
  durationMs: number;
  id: string;
  sourceLanguage: SourceLanguageCode;
  startedAtMs: number;
  targetLanguage: LanguageCode;
  text: string;
};

export type PhoneAudioGift = {
  claimable: boolean;
  remainingMs: number;
};

export type ProFeatures = {
  history: boolean;
  phoneAudio: boolean;
};

export type RatingStars = 1 | 2 | 3 | 4 | 5;

export type RatingAnswer = {
  otherText: string | null;
  stars: RatingStars;
  use: UsageSetting;
};

export type ScreenServices = {
  claimPhoneAudioGift: () => Promise<void>;
  clearInsightsConsent: () => Promise<void>;
  // Saved on this phone when a Pro session ends; reloaded when History opens.
  conversations: ConversationRecord[];
  deleteConversation: (id: string) => Promise<void>;
  features: ProFeatures;
  insightsConsent: boolean | null;
  phoneAudioGift: PhoneAudioGift;
  reloadConversations: () => Promise<void>;
  setInsightsConsent: (consent: boolean) => Promise<void>;
  shareConversation: (id: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  submitRating: (answer: RatingAnswer) => Promise<void>;
};

const noGift: PhoneAudioGift = { claimable: false, remainingMs: 0 };

const ScreenServicesContext = createContext<ScreenServices | null>(null);

export function ScreenServicesProvider({ children }: { children: ReactNode }): ReactNode {
  const { customer, refresh, signInWithApple, signInWithGoogle } = useMurmurBilling();
  const [insightsConsent, setInsightsConsentState] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const history = customer?.features.history ?? false;
  const phoneAudio = customer?.features.phoneAudio ?? false;
  const phoneAudioGift = customer?.gifts?.phoneAudio ?? noGift;
  const historyCustomerId = customer?.customerId ?? null;

  const reloadConversations = useCallback(async () => {
    setConversations(await loadConversations(historyCustomerId, history));
  }, [history, historyCustomerId]);

  useEffect(() => {
    reloadConversations().catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "load_conversation_history" });
    });
  }, [reloadConversations]);

  useEffect(() => {
    import("../lib/insightsConsent")
      .then((consent) => consent.getInsightsConsent())
      .then(setInsightsConsentState)
      .catch((failure: unknown) => {
        captureMobileFailure(failure, { operation: "read_insights_consent" });
      });
  }, []);

  const services = useMemo<ScreenServices>(() => {
    const requireHistoryCustomer = (): string => {
      if (!history || !historyCustomerId) {
        throw new Error("Conversation history is part of Pro.");
      }
      return historyCustomerId;
    };
    return {
      claimPhoneAudioGift: async () => {
        const { claimPhoneAudioGift } = await import("../lib/billing/customerApi");
        await claimPhoneAudioGift();
        await refresh();
      },
      clearInsightsConsent: async () => {
        const { deleteInsightsConsent } = await import("../lib/insightsConsent");
        await deleteInsightsConsent();
        setInsightsConsentState(null);
      },
      conversations,
      deleteConversation: async (id) => {
        const { deleteConversation } = await import("../lib/conversationHistory");
        await deleteConversation(id);
        await reloadConversations();
      },
      features: { history, phoneAudio },
      insightsConsent,
      phoneAudioGift,
      reloadConversations,
      setInsightsConsent: async (consent) => {
        const { setInsightsConsent } = await import("../lib/insightsConsent");
        await setInsightsConsent(consent);
        setInsightsConsentState(consent);
      },
      shareConversation: async (id) => {
        const { shareConversation } = await import("../lib/conversationHistory");
        await shareConversation(requireHistoryCustomer(), id);
      },
      signInWithApple,
      signInWithGoogle,
      submitRating: async (answer) => {
        const { submitRating } = await import("../lib/ratings/ratings");
        await submitRating({
          answer: answer.use,
          ...(answer.otherText ? { otherText: answer.otherText } : {}),
          stars: answer.stars,
        });
      },
    };
  }, [
    conversations,
    history,
    historyCustomerId,
    insightsConsent,
    phoneAudio,
    phoneAudioGift,
    refresh,
    reloadConversations,
    signInWithApple,
    signInWithGoogle,
  ]);
  return <ScreenServicesContext.Provider value={services}>{children}</ScreenServicesContext.Provider>;
}

async function loadConversations(
  customerId: string | null,
  canViewHistory: boolean,
): Promise<ConversationRecord[]> {
  const { getConversation, listConversationSummaries } = await import("../lib/conversationHistory");
  const summaries = await listConversationSummaries();
  return Promise.all(summaries.map(async (summary) => {
    const canView = canViewHistory && customerId === summary.customer_id;
    const entry = canView ? await getConversation(summary.customer_id, summary.id) : null;
    return toConversationRecord(summary, entry);
  }));
}

function toConversationRecord(
  summary: ConversationHistorySummary,
  entry: ConversationHistoryEntry | null,
): ConversationRecord {
  return {
    canView: entry !== null,
    durationMs: summary.duration_ms,
    id: summary.id,
    sourceLanguage: summary.source_language,
    startedAtMs: summary.started_at_ms,
    targetLanguage: summary.target_language,
    text: entry?.translation_text ?? "",
  };
}

export function ScreenServicesFixture(props: { children: ReactNode; services: ScreenServices }): ReactNode {
  return <ScreenServicesContext.Provider value={props.services}>{props.children}</ScreenServicesContext.Provider>;
}

export function useScreenServices(): ScreenServices {
  const services = useContext(ScreenServicesContext);
  if (!services) {
    throw new Error("useScreenServices must be used inside ScreenServicesProvider.");
  }
  return services;
}
