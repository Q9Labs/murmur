import { authErrorMessage } from "../lib/auth/authErrors";
import { freeAllowanceMinutes } from "../lib/billing/allowance";
import type { MurmurBillingContext } from "../lib/billing/context";
import type { MurmurCustomer } from "../lib/billing/customerResponse";
import type { MurmurPlan } from "../lib/billing/planCatalog";
import { codeStep, type EmailSignInState } from "./auth/emailSignInState";
import type { SettingsControls } from "./settings/settingsControls";

const previewCustomer: MurmurCustomer = {
  allowanceMs: freeAllowanceMinutes * 60_000,
  availableMs: freeAllowanceMinutes * 60_000,
  creditMs: 0,
  customerId: "preview-customer",
  earliestExpiryAtMs: null,
  fulfillmentEnabled: true,
  isRegistered: false,
  negativeMs: 0,
  plan: "free",
  purchasesEnabled: true,
  revenueCatCustomerId: "preview:preview-customer",
};

// US ladder from the pricing proposal, for screenshots only. The app shows store prices and
// store product descriptions.
export const previewYearlyPlan: MurmurPlan = {
  description: "2 hours of live translation a month",
  id: "$rc_annual",
  periodLabel: "year",
  price: "$99.99",
  priceAmount: 99.99,
  pricePerMonth: "$8.33",
  term: "yearly",
  title: "Murmur Pro Annual",
};

export const previewPlans: MurmurPlan[] = [
  {
    description: "2 hours of live translation a month",
    id: "$rc_monthly",
    periodLabel: "month",
    price: "$9.99",
    priceAmount: 9.99,
    pricePerMonth: null,
    term: "monthly",
    title: "Murmur Pro",
  },
  previewYearlyPlan,
  {
    description: "60 minutes of live translation",
    id: "trip_pass",
    periodLabel: null,
    price: "$7.99",
    priceAmount: 7.99,
    pricePerMonth: null,
    term: "pack",
    title: "Trip Pass",
  },
  {
    description: "300 minutes of live translation",
    id: "pack_300",
    periodLabel: null,
    price: "$29.99",
    priceAmount: 29.99,
    pricePerMonth: null,
    term: "pack",
    title: "300-minute pack",
  },
];

export const previewBilling: MurmurBillingContext = {
  busy: false,
  config: { enabledLanguages: null, lowBalanceThresholdMinutes: 15, paywallOfferingId: null },
  customer: previewCustomer,
  deleteAccount: async () => undefined,
  error: null,
  loadPlans: async () => previewPlans,
  manageSubscription: async () => undefined,
  notice: null,
  purchasePlan: async () => undefined,
  purchasesAvailable: true,
  refresh: async () => undefined,
  restorePurchases: async () => undefined,
  sendSignInCode: async () => undefined,
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
  deleteLocalData: noop,
  locked: false,
  message: null,
  openReport: noop,
  reportLabel: "Report a translation",
  resetIdentity: noop,
  share: noop,
};
