import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureBilling } from "./__tests__/billingFixture";
import { fixtureServices } from "./__tests__/servicesFixture";
import type { MurmurBillingContext } from "../lib/billing/context";
import type { ScreenServices } from "./screenServices";

const state = vi.hoisted(() => ({ billing: null as MurmurBillingContext | null, seen: null as ScreenServices | null }));
const api = vi.hoisted(() => ({
  claimPhoneAudioGift: vi.fn(async () => undefined),
  deleteConversation: vi.fn(async () => undefined),
  getConversation: vi.fn(async () => null),
  listConversations: vi.fn(async () => []),
  setInsightsConsent: vi.fn(async () => undefined),
  shareConversation: vi.fn(async () => undefined),
  submitRating: vi.fn(async () => undefined),
}));

vi.mock("../lib/billing/context", () => ({ useMurmurBilling: () => state.billing }));
vi.mock("../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("../lib/billing/customerApi", () => ({ claimPhoneAudioGift: api.claimPhoneAudioGift }));
vi.mock("../lib/insightsConsent", () => ({
  deleteInsightsConsent: vi.fn(async () => undefined),
  getInsightsConsent: vi.fn(async () => null),
  setInsightsConsent: api.setInsightsConsent,
}));
vi.mock("../lib/conversationHistory", () => ({
  deleteConversation: api.deleteConversation,
  getConversation: api.getConversation,
  listConversations: api.listConversations,
  shareConversation: api.shareConversation,
}));
vi.mock("../lib/ratings/ratings", () => ({ submitRating: api.submitRating }));

import { ScreenServicesFixture, ScreenServicesProvider, useScreenServices } from "./screenServices";

function Probe() {
  state.seen = useScreenServices();
  return null;
}

function renderServices(billing: MurmurBillingContext): ScreenServices {
  state.billing = billing;
  renderToStaticMarkup(<ScreenServicesProvider><Probe /></ScreenServicesProvider>);
  if (!state.seen) {
    throw new Error("services not rendered");
  }
  return state.seen;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.seen = null;
});

describe("screen services", () => {
  it("reads Pro features and the Phone audio gift from the customer", () => {
    const services = renderServices(fixtureBilling({
      features: { history: false, maxSessionSeconds: 300, phoneAudio: true },
      gifts: { phoneAudio: { claimable: true, remainingMs: 180_000 } },
    }));

    expect(services.features).toEqual({ history: false, phoneAudio: true });
    expect(services.phoneAudioGift).toEqual({ claimable: true, remainingMs: 180_000 });
    expect(services.insightsConsent).toBeNull();
  });

  it("claims the gift, then refreshes the customer", async () => {
    const billing = fixtureBilling();
    const services = renderServices(billing);

    await services.claimPhoneAudioGift();
    expect(api.claimPhoneAudioGift).toHaveBeenCalledOnce();
    expect(billing.refresh).toHaveBeenCalledOnce();
  });

  it("signs in through the account providers", async () => {
    const billing = fixtureBilling();
    const services = renderServices(billing);

    await services.signInWithApple();
    await services.signInWithGoogle();
    expect(billing.signInWithApple).toHaveBeenCalledOnce();
    expect(billing.signInWithGoogle).toHaveBeenCalledOnce();
  });

  it("sends the rating with its answer and only real Other text", async () => {
    const services = renderServices(fixtureBilling());

    await services.submitRating({ otherText: "Parent evening", stars: 5, use: "other" });
    await services.submitRating({ otherText: null, stars: 3, use: "travel" });
    expect(api.submitRating).toHaveBeenNthCalledWith(1, { answer: "other", otherText: "Parent evening", stars: 5 });
    expect(api.submitRating).toHaveBeenNthCalledWith(2, { answer: "travel", stars: 3 });
  });

  it("shares and deletes conversations for the Pro customer only", async () => {
    const pro = renderServices(fixtureBilling({
      features: { history: true, maxSessionSeconds: 3_600, phoneAudio: true },
      plan: "pro",
    }));
    await pro.shareConversation("conversation-1");
    await pro.deleteConversation("conversation-1");
    expect(api.shareConversation).toHaveBeenCalledWith("customer-1", "conversation-1");
    expect(api.deleteConversation).toHaveBeenCalledWith("customer-1", "conversation-1");
    expect(api.listConversations).toHaveBeenCalledWith("customer-1");

    const free = renderServices(fixtureBilling());
    await expect(free.shareConversation("conversation-1")).rejects.toThrow("part of Pro");
  });

  it("saves the insights choice", async () => {
    const services = renderServices(fixtureBilling());

    await services.setInsightsConsent(false);
    expect(api.setInsightsConsent).toHaveBeenCalledWith(false);
  });

  it("serves fixtures to previews and refuses to run outside a provider", () => {
    const services = fixtureServices({ insightsConsent: true });
    renderToStaticMarkup(<ScreenServicesFixture services={services}><Probe /></ScreenServicesFixture>);

    expect(state.seen).toBe(services);
    expect(() => renderToStaticMarkup(<Probe />)).toThrow("ScreenServicesProvider");
  });
});
