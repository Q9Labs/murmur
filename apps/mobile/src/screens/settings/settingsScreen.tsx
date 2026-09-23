import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useMurmurBilling } from "../../lib/billing/context";
import { captureMobileFailure } from "../../lib/observability/sentry";
import { LinkRow, RowGroup, SwitchRow } from "../rowGroup";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useSettingsControls } from "./settingsControls";

const legalUrls = {
  privacy: "https://murmur.q9labs.ai/privacy",
  support: "https://murmur.q9labs.ai/support",
  terms: "https://murmur.q9labs.ai/terms",
} as const;

function openLink(url: string): void {
  Linking.openURL(url).catch((failure: unknown) => {
    captureMobileFailure(failure, { operation: "open_settings_link", stage: "settings" });
  });
}

export function SettingsScreen(): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const controls = useSettingsControls();
  const services = useScreenServices();
  const locked = controls?.locked === true;
  const accountValue = billing.customer?.isRegistered ? "Signed in" : "Guest";

  return (
    <ScreenScaffold title="Settings">
      <RowGroup>
        <LinkRow
          disabled={locked}
          label="Account"
          onPress={() => router.push("/account")}
          value={accountValue}
        />
        <LinkRow label="Conversation history" onPress={() => router.push("/history")} />
      </RowGroup>
      {controls ? (
        <RowGroup>
          <SwitchRow
            disabled={locked}
            label="Anonymous analytics"
            onChange={controls.changeAnalytics}
            value={controls.analyticsEnabled}
          />
          <SwitchRow
            disabled={locked}
            label="Help improve Murmur"
            onChange={(consent) => void services.setInsightsConsent(consent)}
            value={services.insightsConsent === true}
          />
          <LinkRow disabled={locked} label="Share Murmur" onPress={controls.share} />
        </RowGroup>
      ) : null}
      <RowGroup>
        {controls ? (
          <LinkRow
            label={controls.reportLabel}
            onPress={() => {
              controls.openReport();
              router.back();
            }}
          />
        ) : null}
        <LinkRow label="Support" onPress={() => openLink(legalUrls.support)} />
        <LinkRow label="Privacy policy" onPress={() => openLink(legalUrls.privacy)} />
        <LinkRow label="Terms of use" onPress={() => openLink(legalUrls.terms)} />
      </RowGroup>
      {controls ? (
        <RowGroup>
          <LinkRow disabled={locked} label="Reset Murmur identity" onPress={controls.resetIdentity} />
          <LinkRow disabled={locked} label="Delete local data" onPress={controls.deleteLocalData} tone="danger" />
        </RowGroup>
      ) : null}
      <StatusLine error={null} notice={controls?.message ?? null} />
    </ScreenScaffold>
  );
}
