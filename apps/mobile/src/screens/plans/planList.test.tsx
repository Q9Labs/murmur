import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findControl, resetRecorded } from "../__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { PlanListStatus } from "./planList";

beforeEach(() => {
  resetRecorded();
});

describe("plan list states", () => {
  it("shows loading and empty states", () => {
    expect(renderToStaticMarkup(<PlanListStatus onRetry={vi.fn()} plans={{ status: "loading" }} />))
      .toContain("Loading plans");
    expect(renderToStaticMarkup(<PlanListStatus onRetry={vi.fn()} plans={{ plans: [], status: "ready" }} />))
      .toContain("No plans are available");
  });

  it("offers a retry when the store fails", () => {
    const onRetry = vi.fn();
    const markup = renderToStaticMarkup(
      <PlanListStatus onRetry={onRetry} plans={{ message: "Store is down.", status: "failed" }} />,
    );

    expect(markup).toContain("Store is down.");
    findControl("Try loading plans again")?.onPress?.();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
