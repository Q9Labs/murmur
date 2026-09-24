import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "../__tests__/navigation";
import { findControl, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";

const state = vi.hoisted(() => ({ services: null as ScreenServices | null }));

vi.mock("../../home/illustrations", () => ({ sessionInsightsIllustration: 1 }));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("../screenServices", () => ({ useScreenServices: () => state.services }));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));

import { InsightsConsentScreen } from "./insightsConsentScreen";

const yes = "Yes, help improve Murmur";
const no = "No thanks";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  state.services = fixtureServices();
});

describe("insights consent", () => {
  it("discloses what happens to the translation without naming a vendor", () => {
    const markup = renderToStaticMarkup(<InsightsConsentScreen />);

    expect(markup).toContain("a third-party AI service reads the translation and writes a short summary");
    expect(markup).toContain("We keep the summary, never the translation.");
    expect(markup).toContain("You can change this anytime in Settings.");
    expect(markup).not.toMatch(/OpenAI|OpenRouter|GPT/);
  });

  it("leads with yes and keeps no as a visible, enabled answer below it", () => {
    const markup = renderToStaticMarkup(<InsightsConsentScreen />);

    expect(markup).toContain(`<button data-action="primary">${yes}</button><button data-action="quiet">${no}</button>`);
    expect(findControl(yes)?.accessibilityRole).toBe("button");
    expect(findControl(no)?.accessibilityRole).toBe("button");
    expect(findControl(no)?.disabled).toBe(false);
  });

  it("saves the answer and goes back", async () => {
    renderToStaticMarkup(<InsightsConsentScreen />);
    findControl(no)?.onPress?.();

    expect(state.services?.setInsightsConsent).toHaveBeenCalledWith(false);
    await vi.waitFor(() => expect(router.back).toHaveBeenCalledOnce());
  });

  it("stays put when the answer can't be saved", async () => {
    const setInsightsConsent = vi.fn(async () => {
      throw new Error("Offline.");
    });
    state.services = fixtureServices({ setInsightsConsent });
    renderToStaticMarkup(<InsightsConsentScreen />);
    findControl(yes)?.onPress?.();

    await vi.waitFor(() => expect(setInsightsConsent).toHaveBeenCalledWith(true));
    expect(router.back).not.toHaveBeenCalled();
  });
});
