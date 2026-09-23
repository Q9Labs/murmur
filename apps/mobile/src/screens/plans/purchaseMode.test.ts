import { describe, expect, it, vi } from "vitest";

import { fixtureBilling, fixtureYearly } from "../__tests__/billingFixture";
import { purchaseMode } from "./purchaseMode";

describe("purchase mode", () => {
  it("lets a guest buy, then asks them to save the purchase", async () => {
    const billing = fixtureBilling();
    const onGuestPurchased = vi.fn();
    const mode = purchaseMode(billing, onGuestPurchased);

    expect(mode.storeReady).toBe(true);
    mode.onBuy(fixtureYearly);
    expect(billing.purchasePlan).toHaveBeenCalledWith("$rc_annual");
    await vi.waitFor(() => expect(onGuestPurchased).toHaveBeenCalledOnce());
  });

  it("does not ask signed-in or cancelled buyers to save anything", async () => {
    const onGuestPurchased = vi.fn();
    const registered = fixtureBilling({ isRegistered: true });
    purchaseMode(registered, onGuestPurchased).onBuy(fixtureYearly);
    const cancelled = { ...fixtureBilling(), purchasePlan: vi.fn(async () => false) };
    purchaseMode(cancelled, onGuestPurchased).onBuy(fixtureYearly);

    await vi.waitFor(() => expect(cancelled.purchasePlan).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(onGuestPurchased).not.toHaveBeenCalled();
  });

  it("keeps the button disabled while the store is unavailable or busy", () => {
    const billing = fixtureBilling();
    expect(purchaseMode({ ...billing, purchasesAvailable: false }, vi.fn()).storeReady).toBe(false);
    expect(purchaseMode({ ...billing, busy: true }, vi.fn()).storeReady).toBe(false);
    expect(purchaseMode(fixtureBilling({ purchasesEnabled: false }), vi.fn()).storeReady).toBe(false);
  });
});
