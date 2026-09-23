import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixturePlans } from "../__tests__/billingFixture";
import { findControl, resetRecorded } from "../__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("./planPicker", () => ({ PlanPicker: () => <p>plan picker</p> }));

import { PlanList } from "./planList";

const mode = { kind: "sign_up" as const, onSignUp: vi.fn() };

beforeEach(() => {
  resetRecorded();
});

describe("plan list states", () => {
  it("shows loading, empty and ready states", () => {
    expect(renderToStaticMarkup(<PlanList mode={mode} onRetry={vi.fn()} plans={{ status: "loading" }} />))
      .toContain("Loading plans");
    expect(renderToStaticMarkup(<PlanList mode={mode} onRetry={vi.fn()} plans={{ plans: [], status: "ready" }} />))
      .toContain("No plans are available");
    expect(renderToStaticMarkup(
      <PlanList mode={mode} onRetry={vi.fn()} plans={{ plans: fixturePlans, status: "ready" }} />,
    )).toContain("plan picker");
  });

  it("offers a retry when the store fails", () => {
    const onRetry = vi.fn();
    const markup = renderToStaticMarkup(
      <PlanList mode={mode} onRetry={onRetry} plans={{ message: "Store is down.", status: "failed" }} />,
    );

    expect(markup).toContain("Store is down.");
    findControl("Try loading plans again")?.onPress?.();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
