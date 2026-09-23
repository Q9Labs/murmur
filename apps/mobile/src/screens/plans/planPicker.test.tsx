import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureMonthly, fixturePack, fixturePlans, fixtureYearly } from "../__tests__/billingFixture";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => ({ Check: () => null }));

import { PlanPicker } from "./planPicker";

beforeEach(() => {
  resetRecorded();
});

describe("plan picker", () => {
  it("opens on Yearly with the saving computed from store prices", () => {
    const onSignUp = vi.fn();
    const markup = renderToStaticMarkup(
      <PlanPicker mode={{ kind: "sign_up", onSignUp }} plans={fixturePlans} />,
    );

    expect(recorded.roles).toContain("tablist");
    const tabs = recorded.controls.filter((control) => control.accessibilityRole === "tab");
    expect(tabs.map((tab) => [tab.accessibilityLabel, tab.accessibilityState?.selected])).toEqual([
      ["Monthly plans", false],
      ["Yearly plans", true],
      ["Credit packs plans", false],
    ]);
    expect(markup).toContain("$99.99");
    expect(markup).toContain("/ year");
    expect(markup).toContain("$8.33 a month, 1 month free");
    expect(findControl("Murmur Pro Annual, $99.99 / year, Save 16% against monthly")?.accessibilityRole)
      .toBe("summary");

    findControl("Add your email, then buy this plan")?.onPress?.();
    expect(onSignUp).toHaveBeenCalledWith(fixtureYearly);
  });

  it("buys a credit pack from its tab and keeps the button disabled while the store is unavailable", () => {
    const onBuy = vi.fn();
    const markup = renderToStaticMarkup(
      <PlanPicker initialTerm="pack" mode={{ kind: "buy", onBuy, storeReady: true }} plans={fixturePlans} />,
    );

    expect(markup).toContain("Valid 3 months from purchase");
    expect(markup).not.toContain("Renews automatically");
    const buy = recorded.controls.find((control) => control.accessibilityRole === "button");
    buy?.onPress?.();
    expect(onBuy).toHaveBeenCalledWith(fixturePack);

    resetRecorded();
    renderToStaticMarkup(
      <PlanPicker initialTerm="pack" mode={{ kind: "buy", onBuy, storeReady: false }} plans={fixturePlans} />,
    );
    expect(recorded.controls.find((control) => control.accessibilityRole === "button")?.disabled).toBe(true);
  });

  it("drops the tab bar when the offering has only one kind of plan", () => {
    const markup = renderToStaticMarkup(
      <PlanPicker mode={{ kind: "buy", onBuy: vi.fn(), storeReady: true }} plans={[fixtureMonthly]} />,
    );

    expect(recorded.roles).not.toContain("tablist");
    expect(markup).toContain("Subscribe for $9.99 / month");
    expect(markup).toContain("Renews automatically");
  });

  it("lets listeners choose between several credit packs", () => {
    const bigPack = { ...fixturePack, id: "pack_300", price: "$29.99", priceAmount: 29.99, title: "300-minute pack" };
    renderToStaticMarkup(
      <PlanPicker initialTerm="pack" mode={{ kind: "buy", onBuy: vi.fn(), storeReady: true }} plans={[fixturePack, bigPack]} />,
    );

    const radios = recorded.controls.filter((control) => control.accessibilityRole === "radio");
    expect(radios.map((radio) => radio.accessibilityState?.checked)).toEqual([true, false]);
  });
});
