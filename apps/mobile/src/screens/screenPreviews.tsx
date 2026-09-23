import type { ReactNode } from "react";

import { type MurmurBillingContext, MurmurBillingFixtureProvider } from "../lib/billing/context";
import type { PlanTerm } from "../lib/billing/planCatalog";
import { AccountScreen } from "./account/accountScreen";
import { SignInScreen } from "./auth/signInScreen";
import { PlansScreen } from "./plans/plansScreen";
import {
  type AuthPreviewScreen,
  previewAuthStates,
  previewBilling,
  previewCheckoutPlanId,
  previewSettingsControls,
  previewSignedInBilling,
} from "./previewFixtures";
import { SettingsControlsFixture } from "./settings/settingsControls";
import { SettingsScreen } from "./settings/settingsScreen";

export type ScreenPreview =
  | AuthPreviewScreen
  | "account-guest"
  | "account-signed-in"
  | "plans-monthly"
  | "plans-packs"
  | "plans-yearly"
  | "settings";

function WithBilling(props: { billing: MurmurBillingContext; children: ReactNode }): ReactNode {
  return <MurmurBillingFixtureProvider billing={props.billing}>{props.children}</MurmurBillingFixtureProvider>;
}

function PlansPreview({ term }: { term: PlanTerm }): ReactNode {
  return (
    <WithBilling billing={previewBilling}>
      <PlansScreen initialTerm={term} />
    </WithBilling>
  );
}

function AuthPreview({ screen }: { screen: AuthPreviewScreen }): ReactNode {
  return (
    <WithBilling billing={previewBilling}>
      <SignInScreen initialState={previewAuthStates[screen]} planId={previewCheckoutPlanId} />
    </WithBilling>
  );
}

export const screenPreviews: Readonly<Record<ScreenPreview, () => ReactNode>> = {
  "account-guest": () => (
    <WithBilling billing={previewBilling}>
      <AccountScreen />
    </WithBilling>
  ),
  "account-signed-in": () => (
    <WithBilling billing={previewSignedInBilling}>
      <AccountScreen />
    </WithBilling>
  ),
  "auth-code": () => <AuthPreview screen="auth-code" />,
  "auth-code-error": () => <AuthPreview screen="auth-code-error" />,
  "auth-code-expired": () => <AuthPreview screen="auth-code-expired" />,
  "auth-email": () => <AuthPreview screen="auth-email" />,
  "auth-email-error": () => <AuthPreview screen="auth-email-error" />,
  "auth-sending": () => <AuthPreview screen="auth-sending" />,
  "auth-success": () => <AuthPreview screen="auth-success" />,
  "auth-verifying": () => <AuthPreview screen="auth-verifying" />,
  "plans-monthly": () => <PlansPreview term="monthly" />,
  "plans-packs": () => <PlansPreview term="pack" />,
  "plans-yearly": () => <PlansPreview term="yearly" />,
  settings: () => (
    <WithBilling billing={previewBilling}>
      <SettingsControlsFixture controls={previewSettingsControls}>
        <SettingsScreen />
      </SettingsControlsFixture>
    </WithBilling>
  ),
};
