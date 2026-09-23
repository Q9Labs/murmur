import { describe, expect, it, vi } from "vitest";

import { fixtureBilling, fixtureYearly } from "../__tests__/billingFixture";
import { purchaseMode } from "./purchaseMode";

describe("purchase mode", () => {
  it("lets anonymous listeners buy without signing up", () => {
    const onSignUp = vi.fn();
    const billing = fixtureBilling();
    const mode = purchaseMode(billing, onSignUp);

    expect(mode.kind).toBe("buy");
    if (mode.kind === "buy") {
      mode.onBuy(fixtureYearly);
    }
    expect(billing.purchasePlan).toHaveBeenCalledWith("$rc_annual");
    expect(onSignUp).not.toHaveBeenCalled();
  });

  it("buys straight away for signed-in listeners when the store is ready", () => {
    const billing = fixtureBilling({ isRegistered: true });
    const mode = purchaseMode(billing, vi.fn());

    expect(mode).toMatchObject({ kind: "buy", storeReady: true });
    if (mode.kind === "buy") {
      mode.onBuy(fixtureYearly);
    }
    expect(billing.purchasePlan).toHaveBeenCalledWith("$rc_annual");
    expect(purchaseMode({ ...billing, purchasesAvailable: false }, vi.fn())).toMatchObject({ storeReady: false });
  });
});
