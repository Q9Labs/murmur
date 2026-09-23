import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { fixtureBilling } from "./__tests__/billingFixture";
import { fixtureServices } from "./__tests__/servicesFixture";
import type { MurmurBillingContext } from "../lib/billing/context";
import type { ScreenServices } from "./screenServices";

const state = vi.hoisted(() => ({ billing: null as MurmurBillingContext | null, seen: null as ScreenServices | null }));

vi.mock("../lib/billing/context", () => ({ useMurmurBilling: () => state.billing }));

import { ScreenServicesFixture, ScreenServicesProvider, useScreenServices } from "./screenServices";

function Probe() {
  state.seen = useScreenServices();
  return null;
}

describe("screen services", () => {
  it("derives Pro features from the plan until the customer API reports them", async () => {
    state.billing = fixtureBilling({ plan: "pro" });
    renderToStaticMarkup(<ScreenServicesProvider><Probe /></ScreenServicesProvider>);

    expect(state.seen?.features).toEqual({ history: true, phoneAudio: true });
    expect(state.seen?.phoneAudioGift).toEqual({ claimable: false, remainingMs: 0 });
    expect(state.seen?.insightsConsent).toBeNull();
    await expect(state.seen?.signInWithApple()).rejects.toThrow("not available");
    await expect(state.seen?.claimPhoneAudioGift()).rejects.toThrow("not available");
    await expect(state.seen?.submitRating({ otherText: null, stars: 5, use: null })).resolves.toBeUndefined();
  });

  it("keeps free listeners on the gates", () => {
    state.billing = fixtureBilling();
    renderToStaticMarkup(<ScreenServicesProvider><Probe /></ScreenServicesProvider>);

    expect(state.seen?.features).toEqual({ history: false, phoneAudio: false });
  });

  it("serves fixtures to previews and refuses to run outside a provider", () => {
    const services = fixtureServices({ ratingDue: true });
    renderToStaticMarkup(<ScreenServicesFixture services={services}><Probe /></ScreenServicesFixture>);

    expect(state.seen).toBe(services);
    expect(() => renderToStaticMarkup(<Probe />)).toThrow("ScreenServicesProvider");
  });
});
