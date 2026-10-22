import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureCustomer } from "../screens/__tests__/billingFixture";
import { recorded, resetRecorded } from "../screens/__tests__/reactNativePrimitives";
import { en } from "../screens/__tests__/uiText";

vi.mock("react-native", () => import("../screens/__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("./modalSheet", () => import("./__tests__/modalSheetMock"));
vi.mock("./illustrations", () => ({ outOfMinutesIllustration: 1 }));

import { balanceRecovered, OutOfMinutesSheet, outOfMinutesMessage } from "./outOfMinutesSheet";

beforeEach(() => {
  resetRecorded();
});

describe("out-of-minutes sheet", () => {
  it("says what ran out and leads straight to the plans", () => {
    const onSeePlans = vi.fn();
    const markup = renderToStaticMarkup(
      <OutOfMinutesSheet customer={fixtureCustomer} onClose={vi.fn()} onSeePlans={onSeePlans} open />,
    );

    expect(markup).toContain("Out of minutes");
    expect(markup).toContain("You&#x27;ve used your 5 free minutes for this month.");
    recorded.controls.find((control) => control.accessibilityRole === "button")?.onPress?.();
    expect(onSeePlans).toHaveBeenCalledOnce();
  });

  it("words the message for paid customers", () => {
    expect(outOfMinutesMessage({ ...fixtureCustomer, plan: "pro" }, en)).toBe("You've used all your translation time.");
    expect(outOfMinutesMessage(null, en)).not.toContain("free minutes");
    expect(outOfMinutesMessage({ ...fixtureCustomer, freeAllowanceMs: 0 }, en)).not.toContain("free minutes");
    expect(outOfMinutesMessage({ ...fixtureCustomer, freeAllowanceMs: 420_000 }, en)).toContain("7 free minutes");
  });

  it("keeps legacy customers on freemium copy without inventing an allowance", () => {
    expect(outOfMinutesMessage({ ...fixtureCustomer, freeAllowanceMs: null }, en))
      .toBe("You've used your free minutes for this month.");
  });

  it("closes once a refreshed balance is larger than when it opened", () => {
    expect(balanceRecovered(0, 60_000)).toBe(true);
    expect(balanceRecovered(0, 0)).toBe(false);
    expect(balanceRecovered(30_000, 20_000)).toBe(false);
  });
});
