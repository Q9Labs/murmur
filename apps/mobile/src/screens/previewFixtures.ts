import { billingProducts } from "@murmur/protocol/billing/catalog";

import { authErrorMessage } from "../lib/auth/authErrors";
import { freeAllowanceMinutes } from "../lib/billing/allowance";
import type { MurmurBillingContext } from "../lib/billing/context";
import type { MurmurCustomer } from "../lib/billing/customerResponse";
import { type MurmurPlan, plansFromCatalog } from "../lib/billing/planCatalog";
import { codeStep, type EmailSignInState } from "./auth/emailSignInState";
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

// Built from the shared billing catalog so previews always show the shipping ladder.
export const previewPlans: MurmurPlan[] = plansFromCatalog(billingProducts);

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
  purchasePlan: async () => undefined,
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

const previewEmail = "maya@example.com";

export const previewAuthStates = {
  "auth-code": codeStep(previewEmail),
  "auth-code-error": { ...codeStep(previewEmail), error: authErrorMessage({ code: "INVALID_OTP" }, "") },
  "auth-code-expired": { ...codeStep(previewEmail), error: authErrorMessage({ code: "OTP_EXPIRED" }, "") },
  "auth-email": { email: "", error: null, pending: false, step: "email" },
  "auth-email-error": {
    email: "maya@example",
    error: "Enter a valid email address.",
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
  changeInsightsConsent: noop,
  deleteLocalData: noop,
  locked: false,
  insightsConsent: null,
  message: null,
  openReport: noop,
  reportLabel: "Report a translation",
  resetIdentity: noop,
  share: noop,
};
