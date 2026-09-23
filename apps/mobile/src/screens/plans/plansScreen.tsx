import type { MobileTelemetryEvent } from "@murmur/protocol/telemetry";
import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";

import { useUiLocale } from "../../i18n/runtime";
import { useMurmurBilling } from "../../lib/billing/context";
import { introDiscountPercent, type PlanTerm } from "../../lib/billing/planCatalog";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { OfferBanner, remainingOfferMs } from "./offerBanner";
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
  const offer = billing.config.personalOffer;
  const discountPercent = introDiscountPercent(readyPlans);
  const offerExpiresAtMs = offer ? Date.parse(offer.expiresAt) : null;
  const offerOfferingId = offer && discountPercent !== null && remainingOfferMs(offerExpiresAtMs, Date.now()) > 0
    ? offer.offeringId
    : null;

  useEffect(() => {
    if (activeTerm) {
      captureFunnelEvent({ event: "plan_tab_viewed", tab: activeTerm === "pack" ? "credit_packs" : activeTerm });
    }
  }, [activeTerm]);

  useEffect(() => {
    if (offerOfferingId) {
      captureFunnelEvent({ event: "offer_shown", offering_id: offerOfferingId });
    }
  }, [offerOfferingId]);

  return (
    <ScreenScaffold
      footer={picker.selected ? <PlanCheckout mode={mode} plan={picker.selected} /> : null}
      title={t("plans.title")}
    >
      <OfferBanner
        discountPercent={discountPercent}
        expiresAtMs={offerExpiresAtMs}
      />
      {picker.activeTab ? <PlanPicker picker={picker} /> : <PlanListStatus onRetry={refresh} plans={plans} />}
      <StatusLine error={billing.error} notice={billing.notice} />
    </ScreenScaffold>
  );
}

function captureFunnelEvent(payload: MobileTelemetryEvent): void {
  void import("../../lib/telemetry").then((telemetry) => telemetry.captureMobileTelemetry(payload));
}
