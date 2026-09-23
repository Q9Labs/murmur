import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MurmurPlan, PlanTerm } from "../../lib/billing/planCatalog";
import { fixtureMonthly, fixturePack, fixturePlans, fixtureYearly } from "../__tests__/billingFixture";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));

import { PlanCheckout, PlanPicker, type PlanPickerState, usePlanPicker } from "./planPicker";

const seen = { picker: null as PlanPickerState | null };

function Harness(props: { initialTerm?: PlanTerm; plans: MurmurPlan[] }): ReactNode {
  const picker = usePlanPicker(props.plans, props.initialTerm);
  seen.picker = picker;
  return <PlanPicker picker={picker} />;
}

beforeEach(() => {
  resetRecorded();
  seen.picker = null;
});

describe("plan picker", () => {
  it("opens on Yearly with the monthly price computed from store prices", () => {
    const markup = renderToStaticMarkup(<Harness plans={fixturePlans} />);

    expect(recorded.roles).toContain("tablist");
    const tabs = recorded.controls.filter((control) => control.accessibilityRole === "tab");
    expect(tabs.map((tab) => [tab.accessibilityLabel, tab.accessibilityState?.selected])).toEqual([
      ["Monthly plans", false],
      ["Yearly plans", true],
      ["Credit packs plans", false],
    ]);
    expect(markup).toContain("$99.99");
    expect(markup).toContain("/ year");
    expect(markup).toContain("$8.33 a month");
    expect(seen.picker?.selected).toBe(fixtureYearly);
    expect(findControl("Pro, $99.99 / year, $8.33 a month, 2 hours a month, Conversation history, Sessions up to an hour")
      ?.accessibilityRole).toBe("summary");
  });

  it("offers Pro and Pro Max side by side on Monthly, Pro selected first", () => {
    const markup = renderToStaticMarkup(<Harness initialTerm="monthly" plans={fixturePlans} />);

    expect(recorded.roles).toContain("radiogroup");
    const radios = recorded.controls.filter((control) => control.accessibilityRole === "radio");
    expect(radios.map((radio) => radio.accessibilityState?.checked)).toEqual([true, false]);
    expect(markup).toContain("Pro Max");
    expect(markup).toContain("400 minutes a month");
    expect(markup).toContain("Everything in Pro");
    expect(seen.picker?.selected).toBe(fixtureMonthly);
  });

  it("shows credit packs with their validity", () => {
    const markup = renderToStaticMarkup(<Harness initialTerm="pack" plans={fixturePlans} />);

    expect(markup).toContain("Trip Pass");
    expect(markup).toContain("60 minutes");
    expect(markup).toContain("Valid 3 months");
    expect(seen.picker?.selected).toBe(fixturePack);
  });

  it("drops the tab bar when the offering has only one kind of plan", () => {
    renderToStaticMarkup(<Harness plans={[fixtureMonthly]} />);

    expect(recorded.roles).not.toContain("tablist");
  });

  it("renders nothing until plans arrive", () => {
    expect(renderToStaticMarkup(<Harness plans={[]} />)).toBe("");
    expect(seen.picker?.selected).toBeNull();
  });
});

describe("plan checkout", () => {
  it("buys the selected plan and discloses renewal for subscriptions", () => {
    const onBuy = vi.fn();
    const markup = renderToStaticMarkup(<PlanCheckout mode={{ onBuy, storeReady: true }} plan={fixtureMonthly} />);

    expect(markup).toContain("Subscribe for $9.99 / month");
    expect(markup).toContain("Renews automatically");
    recorded.controls.find((control) => control.accessibilityRole === "button")?.onPress?.();
    expect(onBuy).toHaveBeenCalledWith(fixtureMonthly);
  });

  it("keeps the button disabled while the store is unavailable, and drops renewal copy for packs", () => {
    const markup = renderToStaticMarkup(
      <PlanCheckout mode={{ onBuy: vi.fn(), storeReady: false }} plan={fixturePack} />,
    );

    expect(markup).toContain("Buy for $7.99");
    expect(markup).not.toContain("Renews automatically");
    expect(recorded.controls.find((control) => control.accessibilityRole === "button")?.disabled).toBe(true);
  });
});
