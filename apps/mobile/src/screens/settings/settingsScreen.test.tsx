// cspell:ignore EUNSPECIFIED
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fixtureBilling } from "../__tests__/billingFixture";
import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";
import type { SettingsControls } from "./settingsControls";

const controlsRef = vi.hoisted(() => ({ current: null as SettingsControls | null }));
const servicesRef = vi.hoisted(() => ({ current: null as ScreenServices | null }));
const linking = vi.hoisted(() => ({ openURL: vi.fn(async () => true) }));

vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-linking", () => linking);
vi.mock("../../lib/billing/context", () => ({ useMurmurBilling: () => fixtureBilling() }));
const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@sentry/react-native", () => sentry);
vi.mock("./settingsControls", () => ({ useSettingsControls: () => controlsRef.current }));
vi.mock("../screenServices", () => ({ useScreenServices: () => servicesRef.current }));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));

import { SettingsScreen } from "./settingsScreen";
import { sanitizeMobileEvent } from "../../lib/observability/sentry";

function controls(overrides: Partial<SettingsControls> = {}): SettingsControls {
  return {
    analyticsEnabled: true,
    changeAnalytics: vi.fn(),
    deleteLocalData: vi.fn(),
    locked: false,
    message: null,
    openReport: vi.fn(),
    reportLabel: "settings.reportTranslation",
    resetIdentity: vi.fn(),
    share: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  servicesRef.current = fixtureServices();
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
    findControl("Report translation")?.onPress?.();
    expect(controlsRef.current.openReport).toHaveBeenCalledOnce();
    expect(router.back).not.toHaveBeenCalled();
    findControl("Privacy policy")?.onPress?.();
    expect(linking.openURL).toHaveBeenCalledWith("https://murmur.q9labs.ai/privacy");
    findControl("Delete local data")?.onPress?.();
    expect(controlsRef.current.deleteLocalData).toHaveBeenCalledOnce();
  });

  it("opens conversation history and changes the insights choice", () => {
    controlsRef.current = controls();
    renderToStaticMarkup(<SettingsScreen />);

    findControl("Conversation history")?.onPress?.();
    expect(router.push).toHaveBeenCalledWith("/history");
    const insights = recorded.switches.find((candidate) => candidate.accessibilityLabel === "Help improve Murmur");
    expect(insights?.value).toBe(false);
    insights?.onValueChange?.(true);
    expect(servicesRef.current?.setInsightsConsent).toHaveBeenCalledWith(true);
  });

  it("locks session-sensitive rows during a live session", () => {
    controlsRef.current = controls({ locked: true });
    renderToStaticMarkup(<SettingsScreen />);

    expect(findControl("Delete local data")?.disabled).toBe(true);
    expect(findControl("Account, Guest")?.disabled).toBe(true);
    expect(recorded.switches[0]?.disabled).toBe(true);
  });

  it("still offers account and help links when opened directly", () => {
    controlsRef.current = null;
    const markup = renderToStaticMarkup(<SettingsScreen />);

    expect(markup).toContain("Support");
    expect(findControl("Delete local data")).toBeUndefined();
  });
});

  it.each([["Support", "support"], ["Privacy policy", "privacy"], ["Terms of use", "terms"]])("retains safe diagnostics when %s cannot open", async (label, target) => {
    controlsRef.current = controls();
    const url = `https://murmur.q9labs.ai/${target}`;
    const failure = Object.assign(new Error(`Unable to open URL: ${url}`), { code: "EUNSPECIFIED" });
    linking.openURL.mockRejectedValueOnce(failure);
    renderToStaticMarkup(<SettingsScreen />);

    findControl(label)?.onPress?.();

    await vi.waitFor(() => expect(sentry.captureException).toHaveBeenCalledOnce());
    expect(linking.openURL).toHaveBeenCalledWith(url);
    const hint = sentry.captureException.mock.calls[0]?.[1];
    const event = sanitizeMobileEvent({
      ...hint,
      exception: { values: [{ value: failure.message }] },
      type: undefined,
    });
    expect(event.tags).toMatchObject({
      operation: "open_settings_link", stage: "settings", error_code: "EUNSPECIFIED",
      link_target: target, link_step: "open_url", link_failure: "native_open_rejected",
    });
    expect(event.fingerprint).toEqual(["open_settings_link", "settings", "EUNSPECIFIED"]);
    expect(JSON.stringify(event)).not.toContain(url);
    expect(JSON.stringify(event)).not.toContain("Unable to open URL");
  });
