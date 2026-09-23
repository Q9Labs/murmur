import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "../__tests__/navigation";
import { findControl, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";

const state = vi.hoisted(() => ({ services: null as ScreenServices | null }));

vi.mock("../screenServices", () => ({ useScreenServices: () => state.services }));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));

import { InsightsConsentScreen } from "./insightsConsentScreen";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  state.services = fixtureServices();
});

describe("insights consent", () => {
  it("names no vendor and offers two equal answers", () => {
    const markup = renderToStaticMarkup(<InsightsConsentScreen />);

    expect(markup).toContain("a third-party AI service");
    expect(markup).not.toMatch(/OpenAI|OpenRouter|GPT/);
    expect(findControl("Yes")?.accessibilityRole).toBe("button");
    expect(findControl("No")?.accessibilityRole).toBe("button");
  });

  it("saves the answer and goes back", async () => {
    renderToStaticMarkup(<InsightsConsentScreen />);
    findControl("No")?.onPress?.();

    expect(state.services?.setInsightsConsent).toHaveBeenCalledWith(false);
    await vi.waitFor(() => expect(router.back).toHaveBeenCalledOnce());
  });

  it("stays put when the answer can't be saved", async () => {
    const setInsightsConsent = vi.fn(async () => {
      throw new Error("Offline.");
    });
    state.services = fixtureServices({ setInsightsConsent });
    renderToStaticMarkup(<InsightsConsentScreen />);
    findControl("Yes")?.onPress?.();

    await vi.waitFor(() => expect(setInsightsConsent).toHaveBeenCalledWith(true));
    expect(router.back).not.toHaveBeenCalled();
  });
});
