import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { MurmurBillingContext } from "../lib/billing/context";
import type { ScreenServices } from "./screenServices";

const seen = vi.hoisted(() => ({
  billing: [] as MurmurBillingContext[],
  screens: [] as string[],
  services: [] as ScreenServices[],
}));

function screen(name: string) {
  return (props: { id?: string; initialTerm?: string; planId?: string }) => {
    seen.screens.push([name, props.initialTerm ?? props.planId ?? props.id].filter(Boolean).join(":"));
    return null;
  };
}

vi.mock("./account/accountScreen", () => ({ AccountScreen: screen("account") }));
vi.mock("./auth/savePurchaseScreen", () => ({ SavePurchaseScreen: screen("save-purchase") }));
vi.mock("./auth/signInScreen", () => ({ SignInScreen: screen("sign-in") }));
vi.mock("./history/conversationScreen", () => ({ ConversationScreen: screen("conversation") }));
vi.mock("./history/historyScreen", () => ({ HistoryScreen: screen("history") }));
vi.mock("./insights/insightsConsentScreen", () => ({ InsightsConsentScreen: screen("insights-consent") }));
vi.mock("./phoneAudio/phoneAudioScreen", () => ({ PhoneAudioScreen: screen("phone-audio") }));
vi.mock("./plans/plansScreen", () => ({ PlansScreen: screen("plans") }));
vi.mock("./settings/languageScreen", () => ({ LanguageScreen: screen("app-language") }));
vi.mock("./settings/settingsScreen", () => ({ SettingsScreen: screen("settings") }));
vi.mock("./settings/settingsControls", () => ({
  SettingsControlsFixture: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./screenServices", () => ({
  ScreenServicesFixture: ({ children, services }: { children: ReactNode; services: ScreenServices }) => {
    seen.services.push(services);
    return children;
  },
}));
vi.mock("../lib/billing/context", () => ({
  MurmurBillingFixtureProvider: ({ billing, children }: { billing: MurmurBillingContext; children: ReactNode }) => {
    seen.billing.push(billing);
    return children;
  },
}));

import { screenPreviews } from "./screenPreviews";

function renderPreview(preview: () => ReactNode): void {
  seen.billing.length = 0;
  seen.screens.length = 0;
  seen.services.length = 0;
  renderToStaticMarkup(<>{preview()}</>);
}

function render(name: keyof typeof screenPreviews): void {
  renderPreview(screenPreviews[name]);
}

describe("screen previews", () => {
  it("renders every screen preview from fixtures", () => {
    for (const preview of Object.values(screenPreviews)) {
      renderPreview(preview);
      expect(seen.screens).toHaveLength(1);
    }
  });

  it("opens plans on the requested tab, with the offer where asked", () => {
    render("plans-offer");
    expect(seen.screens).toEqual(["plans:monthly"]);
    expect(Date.parse(seen.billing[0]?.config.personalOffer?.expiresAt ?? "")).toBeGreaterThan(Date.now());
    render("plans-packs");
    expect(seen.screens).toEqual(["plans:pack"]);
    render("auth-code");
    expect(seen.screens).toEqual(["sign-in:$rc_annual"]);
  });

  it("gives each Pro feature state its own services", () => {
    render("phone-audio-gift");
    expect(seen.services[0]?.phoneAudioGift.claimable).toBe(true);
    render("phone-audio-claimed");
    expect(seen.services[0]?.phoneAudioGift.remainingMs).toBe(180_000);
    render("history-gate");
    expect(seen.services[0]?.features.history).toBe(false);
    render("history-detail");
    expect(seen.screens).toEqual(["conversation:preview-conference"]);
    render("save-purchase-saved");
    expect(seen.billing[0]?.customer?.isRegistered).toBe(true);
  });
});
