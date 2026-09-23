import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useMurmurBilling } from "../lib/billing/context";
import type { UsageSetting } from "./rating/usageChoices";

// The seam between the 1.3.0 screens and the logic other lanes own (contract sections
// 1 to 6). Each field is documented with the lane and API that replaces its placeholder.

export type ConversationRecord = {
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

export type RatingAnswer = {
  otherText: string | null;
  stars: number;
  use: UsageSetting | null;
};

export type ScreenServices = {
  // runtime lane: POST /v3/gifts/phone-audio/claim, then refetch /v3/customer.
  claimPhoneAudioGift: () => Promise<void>;
  // runtime lane: sessions saved on the device when a Pro session ends.
  conversations: ConversationRecord[];
  deleteConversation: (id: string) => Promise<void>;
  // billing lane: /v3/customer `features.phone_audio` and `features.history`.
  features: ProFeatures;
  // insights lane: the stored choice, sent as `insights_consent` on session create.
  insightsConsent: boolean | null;
  // billing lane: /v3/customer `gifts.phone_audio`.
  phoneAudioGift: PhoneAudioGift;
  // insights lane: the rating schedule in contract section 6.
  ratingDue: boolean;
  setInsightsConsent: (consent: boolean) => Promise<void>;
  // auth lane: signInWithApple() and signInWithGoogle(), ending signed in like email.
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  // insights lane: `rating_submitted`, then the store review prompt rules.
  submitRating: (answer: RatingAnswer) => Promise<void>;
};

async function notConnected(): Promise<void> {
  throw new Error("This is not available in this build yet.");
}

const ScreenServicesContext = createContext<ScreenServices | null>(null);

// Placeholder implementations until the owning lanes merge. They keep every screen
// usable without pretending a server call happened.
export function ScreenServicesProvider({ children }: { children: ReactNode }): ReactNode {
  const { customer } = useMurmurBilling();
  const [insightsConsent, setInsightsConsent] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const paid = customer !== null && customer.plan !== "free";
  const services = useMemo<ScreenServices>(() => ({
    claimPhoneAudioGift: notConnected,
    conversations,
    deleteConversation: async (id) => {
      setConversations((current) => current.filter((record) => record.id !== id));
    },
    features: { history: paid, phoneAudio: paid },
    insightsConsent,
    phoneAudioGift: { claimable: false, remainingMs: 0 },
    ratingDue: false,
    setInsightsConsent: async (consent) => {
      setInsightsConsent(consent);
    },
    signInWithApple: notConnected,
    signInWithGoogle: notConnected,
    submitRating: async () => undefined,
  }), [conversations, insightsConsent, paid]);
  return <ScreenServicesContext.Provider value={services}>{children}</ScreenServicesContext.Provider>;
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
