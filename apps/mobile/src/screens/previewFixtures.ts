import { LocalizedError } from "../i18n/localizedError";
import { authError } from "../lib/auth/authErrors";
import { freeAllowanceMinutes } from "../lib/billing/allowance";
import type { MurmurBillingContext } from "../lib/billing/context";
import type { MurmurCustomer } from "../lib/billing/customerResponse";
import type { MurmurPlan } from "../lib/billing/planCatalog";
import { codeStep, type EmailSignInState } from "./auth/emailSignInState";
import type { ConversationRecord, ScreenServices } from "./screenServices";
import type { SettingsControls } from "./settings/settingsControls";

const previewCustomer: MurmurCustomer = {
  allowanceMs: freeAllowanceMinutes * 60_000,
  availableMs: freeAllowanceMinutes * 60_000,
  creditMs: 0,
  customerId: "preview-customer",
  creditPacks: [],
  earliestExpiryAtMs: null,
  entitlements: { pro: false, proMax: false },
  features: { history: false, maxSessionSeconds: 300, phoneAudio: false },
  fulfillmentEnabled: true,
  isRegistered: false,
  negativeMs: 0,
  plan: "free",
  purchasesEnabled: true,
  revenueCatCustomerId: "preview:preview-customer",
};

function subscription(
  id: string,
  tier: "pro" | "pro_max",
  term: "monthly" | "yearly",
  price: number,
  minutes: number,
): MurmurPlan {
  return {
    description: `${minutes} minutes of live translation a month`,
    id,
    introPrice: null,
    minutes,
    period: term === "monthly" ? "month" : "year",
    price: formatUsd(price),
    priceAmount: price,
    pricePerMonth: term === "yearly" ? formatUsd(Math.floor((price / 12) * 100) / 100) : null,
    term,
    tier,
    title: tier === "pro" ? "Pro" : "Pro Max",
  };
}

function pass(id: string, title: string, price: number, minutes: number): MurmurPlan {
  return {
    description: `${minutes} minutes of live translation`,
    id,
    introPrice: null,
    minutes,
    period: null,
    price: formatUsd(price),
    priceAmount: price,
    pricePerMonth: null,
    term: "pack",
    tier: null,
    title,
  };
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// The US ladder from the 1.3.0 pricing proposal (section 8), as the store would return it.
export const previewPlans: MurmurPlan[] = [
  subscription("$rc_monthly", "pro", "monthly", 9.99, 120),
  subscription("promax_monthly", "pro_max", "monthly", 29.99, 400),
  subscription("$rc_annual", "pro", "yearly", 99.99, 120),
  subscription("promax_annual", "pro_max", "yearly", 299.99, 400),
  pass("trip_pass_60", "Trip Pass", 7.99, 60),
  pass("event_pass_300", "Event Pass", 29.99, 300),
];

// The personal_offer offering: Pro carries the 20% introductory price.
export const previewOfferPlans: MurmurPlan[] = previewPlans.map((plan) => {
  if (plan.id === "$rc_monthly") {
    return { ...plan, introPrice: { amount: 7.99, price: "$7.99" } };
  }
  if (plan.id === "$rc_annual") {
    return { ...plan, introPrice: { amount: 79.99, price: "$79.99" } };
  }
  return plan;
});

export const previewCheckoutPlanId = previewPlans.find((plan) => plan.term === "yearly")?.id;

export const previewBilling: MurmurBillingContext = {
  busy: false,
  config: {
    enabledLanguages: null,
    lowBalanceThresholdMinutes: 15,
    paywallOfferingId: null,
    personalOffer: null,
  },
  configLoaded: true,
  customer: previewCustomer,
  deleteAccount: async () => undefined,
  error: null,
  initialized: true,
  loadPlans: async () => previewPlans,
  loadPlansSilently: async () => previewPlans,
  manageSubscription: async () => undefined,
  notice: null,
  purchasePlan: async () => true,
  purchasesAvailable: true,
  refresh: async () => undefined,
  restorePurchases: async () => undefined,
  sendSignInCode: async () => undefined,
  signInWithApple: async () => undefined,
  signInWithGoogle: async () => undefined,
  switchAccount: async () => undefined,
  syncing: false,
  verifySignInCode: async () => undefined,
};

export function previewBillingFor(customer: Partial<MurmurCustomer>): MurmurBillingContext {
  return { ...previewBilling, customer: { ...previewCustomer, ...customer } };
}

export const previewSignedInBilling = previewBillingFor({
  availableMs: 97 * 60_000,
  isRegistered: true,
  plan: "pro",
});

export const previewProMaxBilling = previewBillingFor({
  availableMs: 352 * 60_000,
  isRegistered: true,
  plan: "pro_max",
});

const previewEmail = "maya@example.com";

export const previewAuthStates = {
  "auth-code": codeStep(previewEmail),
  "auth-code-error": { ...codeStep(previewEmail), error: authError({ code: "INVALID_OTP" }, "auth.codeFailed") },
  "auth-code-expired": { ...codeStep(previewEmail), error: authError({ code: "OTP_EXPIRED" }, "auth.codeFailed") },
  "auth-email": { email: "", error: null, pending: false, step: "email" },
  "auth-email-error": {
    email: "maya@example",
    error: new LocalizedError("auth.invalidEmail"),
    pending: false,
    step: "email",
  },
  "auth-sending": { email: previewEmail, error: null, pending: true, step: "email" },
  "auth-success": { email: previewEmail, step: "done" },
  "auth-verifying": { ...codeStep(previewEmail), code: "482913", pending: "verify" },
} as const satisfies Readonly<Record<string, EmailSignInState>>;

export type AuthPreviewScreen = keyof typeof previewAuthStates;

function noop(): void {}

export const previewSettingsControls: SettingsControls = {
  analyticsEnabled: true,
  changeAnalytics: noop,
  deleteLocalData: noop,
  locked: false,
  message: null,
  openReport: noop,
  reportLabel: "settings.reportTranslation",
  resetIdentity: noop,
  share: noop,
};

const previewOfferingId = "personal_offer";

// Ends 47 hours 12 minutes after the preview opens, like a freshly started offer.
export function previewOfferBilling(nowMs: number): MurmurBillingContext {
  return {
    ...previewBilling,
    config: {
      ...previewBilling.config,
      paywallOfferingId: previewOfferingId,
      personalOffer: { expiresAt: new Date(nowMs + (47 * 60 + 12) * 60_000).toISOString(), offeringId: previewOfferingId },
    },
    loadPlans: async () => previewOfferPlans,
  };
}

export const previewUnsavedBilling = previewBillingFor({ availableMs: 118 * 60_000, plan: "pro" });

export const previewPackBilling = previewBillingFor({
  availableMs: 64 * 60_000,
  creditMs: 90 * 60_000,
  creditPacks: [
    { expiresAtMs: Date.UTC(2026, 11, 22, 12), grantId: "preview-trip", remainingMs: 60 * 60_000 },
    { expiresAtMs: Date.UTC(2027, 1, 14, 12), grantId: "preview-event", remainingMs: 30 * 60_000 },
  ],
  earliestExpiryAtMs: Date.UTC(2026, 11, 22, 12),
  isRegistered: true,
});

const hourMs = 3_600_000;

export const previewConversations: ConversationRecord[] = [
  {
    durationMs: 42 * 60_000,
    id: "preview-conference",
    sourceLanguage: "ar",
    startedAtMs: Date.UTC(2026, 8, 22, 9, 30),
    targetLanguage: "en",
    text: "Good morning and welcome to the second day of the summit. Today we will talk about water, about the cities "
      + "that are growing faster than their pipes, and about the people who keep them running. Our first speaker has "
      + "spent twenty years building water systems in the desert.",
  },
  {
    durationMs: 8 * 60_000,
    id: "preview-pharmacy",
    sourceLanguage: "es",
    startedAtMs: Date.UTC(2026, 8, 20, 17, 5),
    targetLanguage: "en",
    text: "Take one tablet in the morning and one at night, always with food. If you feel dizzy, stop and call us.",
  },
  {
    durationMs: 3 * hourMs / 60,
    id: "preview-taxi",
    sourceLanguage: "auto",
    startedAtMs: Date.UTC(2026, 8, 18, 22, 40),
    targetLanguage: "en",
    text: "The airport road is closed tonight, so we will go along the coast. It takes ten minutes longer.",
  },
];

async function resolved(): Promise<void> {}

export const previewServices: ScreenServices = {
  claimPhoneAudioGift: resolved,
  clearInsightsConsent: resolved,
  conversations: previewConversations,
  deleteConversation: resolved,
  features: { history: true, phoneAudio: true },
  insightsConsent: null,
  phoneAudioGift: { claimable: false, remainingMs: 0 },
  reloadConversations: resolved,
  setInsightsConsent: resolved,
  shareConversation: resolved,
  signInWithApple: resolved,
  signInWithGoogle: resolved,
  submitRating: resolved,
};

export const previewFreeServices: ScreenServices = {
  ...previewServices,
  conversations: [],
  features: { history: false, phoneAudio: false },
};
