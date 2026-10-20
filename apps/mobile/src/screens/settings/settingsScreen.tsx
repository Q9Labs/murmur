import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useUiLocale } from "../../i18n/runtime";
import { uiLocaleNames } from "../../i18n/types";
import { useMurmurBilling } from "../../lib/billing/context";
import { openLegalLink } from "../../lib/legalLinks";
import { LinkRow, RowGroup, SwitchRow } from "../rowGroup";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useSettingsControls } from "./settingsControls";

export function SettingsScreen(): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const controls = useSettingsControls();
  const services = useScreenServices();
  const locked = controls?.locked === true;
  const { preference, t } = useUiLocale();
  const languageValue = preference === "system" ? t("settings.systemDefault") : uiLocaleNames[preference];
  const accountValue = t(billing.customer?.isRegistered ? "settings.signedIn" : "settings.guest");

  return (
    <ScreenScaffold title={t("settings.title")}>
      <RowGroup>
        <LinkRow
          disabled={locked}
          label={t("settings.account")}
          onPress={() => router.push("/account")}
          value={accountValue}
        />
        <LinkRow label={t("settings.history")} onPress={() => router.push("/history")} />
        <LinkRow
          label={t("settings.appLanguage")}
          onPress={() => router.push("/language")}
          value={languageValue}
        />
      </RowGroup>
      {controls ? (
        <RowGroup>
          <SwitchRow
            disabled={locked}
            label={t("settings.analytics")}
            onChange={controls.changeAnalytics}
            value={controls.analyticsEnabled}
          />
          <SwitchRow
            disabled={locked}
            label={t("settings.helpImprove")}
            onChange={(consent) => void services.setInsightsConsent(consent)}
            value={services.insightsConsent === true}
          />
          <LinkRow disabled={locked} label={t("settings.shareMurmur")} onPress={controls.share} />
        </RowGroup>
      ) : null}
      <RowGroup>
        {controls ? (
          <LinkRow
            label={t(controls.reportLabel)}
            onPress={controls.openReport}
          />
        ) : null}
        <LinkRow label={t("settings.support")} onPress={() => void openLegalLink("support", "settings")} />
        <LinkRow label={t("settings.privacyPolicy")} onPress={() => void openLegalLink("privacy", "settings")} />
        <LinkRow label={t("settings.termsOfUse")} onPress={() => void openLegalLink("terms", "settings")} />
      </RowGroup>
      {controls ? (
        <RowGroup>
          <LinkRow disabled={locked} label={t("settings.resetMurmurIdentity")} onPress={controls.resetIdentity} />
          <LinkRow disabled={locked} label={t("settings.deleteLocalData")} onPress={controls.deleteLocalData} tone="danger" />
        </RowGroup>
      ) : null}
      <StatusLine error={null} notice={controls?.message ?? null} />
    </ScreenScaffold>
  );
}
