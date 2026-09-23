import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "./__tests__/navigation";
import { findControl, resetRecorded } from "./__tests__/reactNativePrimitives";

vi.mock("./screenScaffold", () => import("./__tests__/scaffoldMock"));
vi.mock("expo-router", () => import("./__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native", () => import("./__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { ProGate } from "./proGate";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

describe("Pro gate", () => {
  it("says what the feature does and leads to the Pro plans", () => {
    const markup = renderToStaticMarkup(<ProGate body="Keep your translations." title="Conversation history" />);

    expect(markup).toContain("Conversation history");
    expect(markup).toContain("Keep your translations.");
    findControl("See Pro plans")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith({ params: { term: "monthly" }, pathname: "/plans" });
  });
});
