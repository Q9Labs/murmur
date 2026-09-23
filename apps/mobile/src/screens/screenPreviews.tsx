import type { ReactNode } from "react";

import { type MurmurBillingContext, MurmurBillingFixtureProvider } from "../lib/billing/context";
import type { PlanTerm } from "../lib/billing/planCatalog";
import { AccountScreen } from "./account/accountScreen";
import { SavePurchaseScreen } from "./auth/savePurchaseScreen";
import { SignInScreen } from "./auth/signInScreen";
import { ConversationScreen } from "./history/conversationScreen";
import { HistoryScreen } from "./history/historyScreen";
import { InsightsConsentScreen } from "./insights/insightsConsentScreen";
import { PhoneAudioScreen } from "./phoneAudio/phoneAudioScreen";
import { PlansScreen } from "./plans/plansScreen";
import {
  type AuthPreviewScreen,
  previewAuthStates,
  previewBilling,
  previewCheckoutPlanId,
  previewConversations,
  previewFreeServices,
  previewOfferBilling,
  previewPackBilling,
  previewServices,
  previewSettingsControls,
  previewSignedInBilling,
  previewUnsavedBilling,
} from "./previewFixtures";
import { type ScreenServices, ScreenServicesFixture } from "./screenServices";
import { SettingsControlsFixture } from "./settings/settingsControls";
import { SettingsScreen } from "./settings/settingsScreen";

export type ScreenPreview =
  | AuthPreviewScreen
  | "account-guest"
  | "account-pack"
  | "account-signed-in"
  | "account-unsaved"
  | "history"
  | "history-detail"
  | "history-empty"
  | "history-gate"
  | "insights-consent"
  | "phone-audio-claimed"
  | "phone-audio-gate"
  | "phone-audio-gift"
  | "plans-monthly"
  | "plans-offer"
  | "plans-packs"
  | "plans-yearly"
  | "save-purchase"
  | "save-purchase-saved"
  | "settings";

function WithFixtures(props: {
  billing?: MurmurBillingContext;
  children: ReactNode;
  services?: ScreenServices;
}): ReactNode {
  return (
    <MurmurBillingFixtureProvider billing={props.billing ?? previewBilling}>
      <ScreenServicesFixture services={props.services ?? previewServices}>{props.children}</ScreenServicesFixture>
    </MurmurBillingFixtureProvider>
  );
}

function PlansPreview({ billing, term }: { billing?: MurmurBillingContext; term: PlanTerm }): ReactNode {
  return (
    <WithFixtures billing={billing}>
      <PlansScreen initialTerm={term} />
    </WithFixtures>
  );
}

function AuthPreview({ screen }: { screen: AuthPreviewScreen }): ReactNode {
  return (
    <WithFixtures>
      <SignInScreen initialState={previewAuthStates[screen]} planId={previewCheckoutPlanId} />
    </WithFixtures>
  );
}

function PhoneAudioPreview({ services }: { services: ScreenServices }): ReactNode {
  return (
    <WithFixtures services={services}>
      <PhoneAudioScreen />
    </WithFixtures>
  );
}

export const screenPreviews: Readonly<Record<ScreenPreview, () => ReactNode>> = {
  "account-guest": () => <WithFixtures><AccountScreen /></WithFixtures>,
  "account-pack": () => <WithFixtures billing={previewPackBilling}><AccountScreen /></WithFixtures>,
  "account-signed-in": () => <WithFixtures billing={previewSignedInBilling}><AccountScreen /></WithFixtures>,
  "account-unsaved": () => <WithFixtures billing={previewUnsavedBilling}><AccountScreen /></WithFixtures>,
  "auth-code": () => <AuthPreview screen="auth-code" />,
  "auth-code-error": () => <AuthPreview screen="auth-code-error" />,
  "auth-code-expired": () => <AuthPreview screen="auth-code-expired" />,
  "auth-email": () => <AuthPreview screen="auth-email" />,
  "auth-email-error": () => <AuthPreview screen="auth-email-error" />,
  "auth-sending": () => <AuthPreview screen="auth-sending" />,
  "auth-success": () => <AuthPreview screen="auth-success" />,
  "auth-verifying": () => <AuthPreview screen="auth-verifying" />,
  history: () => <WithFixtures><HistoryScreen /></WithFixtures>,
  "history-detail": () => <WithFixtures><ConversationScreen id={previewConversations[0]?.id} /></WithFixtures>,
  "history-empty": () => (
    <WithFixtures services={{ ...previewServices, conversations: [] }}>
      <HistoryScreen />
    </WithFixtures>
  ),
  "history-gate": () => <WithFixtures services={previewFreeServices}><HistoryScreen /></WithFixtures>,
  "insights-consent": () => <WithFixtures><InsightsConsentScreen /></WithFixtures>,
  "phone-audio-claimed": () => (
    <PhoneAudioPreview services={{ ...previewFreeServices, phoneAudioGift: { claimable: false, remainingMs: 180_000 } }} />
  ),
  "phone-audio-gate": () => <PhoneAudioPreview services={previewFreeServices} />,
  "phone-audio-gift": () => (
    <PhoneAudioPreview services={{ ...previewFreeServices, phoneAudioGift: { claimable: true, remainingMs: 0 } }} />
  ),
  "plans-monthly": () => <PlansPreview term="monthly" />,
  "plans-offer": () => <PlansPreview billing={previewOfferBilling(Date.now())} term="monthly" />,
  "plans-packs": () => <PlansPreview term="pack" />,
  "plans-yearly": () => <PlansPreview term="yearly" />,
  "save-purchase": () => <WithFixtures billing={previewUnsavedBilling}><SavePurchaseScreen /></WithFixtures>,
  "save-purchase-saved": () => <WithFixtures billing={previewSignedInBilling}><SavePurchaseScreen /></WithFixtures>,
  settings: () => (
    <WithFixtures>
      <SettingsControlsFixture controls={previewSettingsControls}>
        <SettingsScreen />
      </SettingsControlsFixture>
    </WithFixtures>
  ),
};
