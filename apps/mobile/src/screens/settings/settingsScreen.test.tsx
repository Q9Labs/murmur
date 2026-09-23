import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureBilling } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";
import type { SettingsControls } from "./settingsControls";

const controlsRef = vi.hoisted(() => ({ current: null as SettingsControls | null }));
const linking = vi.hoisted(() => ({ openURL: vi.fn(async () => true) }));

vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-linking", () => linking);
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => fixtureBilling() }));
vi.mock("../../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("./settingsControls", () => ({ useSettingsControls: () => controlsRef.current }));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));

import { SettingsScreen } from "./settingsScreen";

function controls(overrides: Partial<SettingsControls> = {}): SettingsControls {
  return {
    analyticsEnabled: true,
    changeAnalytics: vi.fn(),
    deleteLocalData: vi.fn(),
    locked: false,
    message: null,
    openReport: vi.fn(),
    reportLabel: "Report a translation",
    resetIdentity: vi.fn(),
    share: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

describe("settings screen", () => {
  it("groups account, preferences, help and data rows", () => {
    controlsRef.current = controls({ message: "Anonymous analytics disabled." });
    const markup = renderToStaticMarkup(<SettingsScreen />);

    expect(markup).toContain("Anonymous analytics disabled.");
    findControl("Account, Guest")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith("/account");
    recorded.switches[0]?.onValueChange?.(false);
    expect(controlsRef.current.changeAnalytics).toHaveBeenCalledWith(false);
    findControl("Report a translation")?.onPress?.();
    expect(controlsRef.current.openReport).toHaveBeenCalledOnce();
    expect(router.back).toHaveBeenCalledOnce();
    findControl("Privacy policy")?.onPress?.();
    expect(linking.openURL).toHaveBeenCalledWith("https://murmur.q9labs.ai/privacy");
    findControl("Delete local data")?.onPress?.();
    expect(controlsRef.current.deleteLocalData).toHaveBeenCalledOnce();
  });

  it("locks session-sensitive rows during a live session", () => {
    controlsRef.current = controls({ locked: true });
    renderToStaticMarkup(<SettingsScreen />);

    expect(findControl("Delete local data")?.disabled).toBe(true);
    expect(recorded.switches[0]?.disabled).toBe(true);
  });

  it("still offers account and help links when opened directly", () => {
    controlsRef.current = null;
    const markup = renderToStaticMarkup(<SettingsScreen />);

    expect(markup).toContain("Support");
    expect(findControl("Delete local data")).toBeUndefined();
  });
});
