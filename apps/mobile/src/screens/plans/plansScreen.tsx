import type { MobileTelemetryEvent } from "@murmur/protocol/telemetry";
import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";

import { useUiLocale } from "../../i18n/runtime";
import { openLegalLink } from "../../lib/legalLinks";
import { LinkRow, RowGroup } from "../rowGroup";
import { useMurmurBilling } from "../../lib/billing/context";
import type { PlanTerm } from "../../lib/billing/planCatalog";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { OfferBanner, usePersonalOffer } from "./offerBanner";
import { PlanListStatus, usePlanList } from "./planList";
import { PlanCheckout, PlanPicker, usePlanPicker } from "./planPicker";
import { purchaseMode } from "./purchaseMode";

export function planTermFromParam(value: string | string[] | undefined): PlanTerm | undefined {
  const param = Array.isArray(value) ? value[0] : value;
  switch (param) {
    case "monthly":
      return "monthly";
    case "yearly":
      return "yearly";
    case "packs":
      return "pack";
    default:
      return undefined;
  }
}

export function PlansScreen(props: { initialTerm?: PlanTerm }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { t } = useUiLocale();
  const { plans, refresh } = usePlanList(billing.initialized, billing.loadPlans);
  const readyPlans = plans.status === "ready" ? plans.plans : [];
  const picker = usePlanPicker(readyPlans, props.initialTerm);
  const mode = purchaseMode(billing, () => router.replace("/save-purchase"));
  const activeTerm = picker.activeTab?.term ?? null;
  const offer = usePersonalOffer(billing.config.personalOffer, readyPlans);

  useEffect(() => {
    if (activeTerm) {
      captureFunnelEvent({ event: "plan_tab_viewed", surface: "plan_picker", tab: activeTerm === "pack" ? "credit_packs" : activeTerm });
    }
  }, [activeTerm]);

  return (
    <ScreenScaffold
      footer={picker.selected ? <PlanCheckout mode={mode} plan={picker.selected} /> : null}
      title={t("plans.title")}
    >
      <OfferBanner
        discountPercent={offer.discountPercent}
        expiresAtMs={offer.expiresAtMs}
      />
      {picker.activeTab ? <PlanPicker picker={picker} /> : <PlanListStatus onRetry={refresh} plans={plans} />}
      <RowGroup>
        <LinkRow
          disabled={billing.busy || !billing.purchasesAvailable}
          label={t("account.restorePurchases")}
          onPress={() => void billing.restorePurchases()}
        />
        <LinkRow label={t("settings.termsOfUse")} onPress={() => void openLegalLink("terms", "billing")} />
        <LinkRow label={t("settings.privacyPolicy")} onPress={() => void openLegalLink("privacy", "billing")} />
      </RowGroup>
      <StatusLine error={billing.error} notice={billing.notice} />
    </ScreenScaffold>
  );
}

function captureFunnelEvent(payload: MobileTelemetryEvent): void {
  void import("../../lib/telemetry").then((telemetry) => telemetry.captureMobileTelemetry(payload));
}
