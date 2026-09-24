import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "../__tests__/navigation";
import { findControl, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";

const state = vi.hoisted(() => ({ services: null as ScreenServices | null }));

vi.mock("../../home/illustrations", () => ({ phoneAudioGiftIllustration: 1, phoneAudioIllustration: 2 }));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("../proGate", () => ({ ProGate: (props: { lead: string; title: string }) => <p>gate {props.title}. {props.lead}</p> }));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("../screenServices", () => ({ useScreenServices: () => state.services }));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));

import { PhoneAudioScreen } from "./phoneAudioScreen";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

describe("phone audio screen", () => {
  it("offers the 3-minute gift and claims it", () => {
    state.services = fixtureServices({ phoneAudioGift: { claimable: true, remainingMs: 0 } });
    const markup = renderToStaticMarkup(<PhoneAudioScreen />);

    expect(markup).toContain("A gift for you");
    findControl("Claim 3 free minutes")?.onPress?.();
    expect(state.services.claimPhoneAudioGift).toHaveBeenCalledOnce();
    findControl("Not now")?.onPress?.();
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("shows the claimed gift with its time left and switches home to phone audio", () => {
    state.services = fixtureServices({
      features: { history: false, phoneAudio: true },
      phoneAudioGift: { claimable: false, remainingMs: 95_000 },
    });
    const markup = renderToStaticMarkup(<PhoneAudioScreen />);

    expect(markup).toContain("Phone audio is yours");
    expect(markup).toContain("2 free minutes left");
    findControl("Use Phone audio")?.onPress?.();
    expect(router.dismissTo).toHaveBeenCalledWith({ params: { capture: "phone-audio" }, pathname: "/" });
  });

  it("gates free listeners without a gift behind Pro", () => {
    state.services = fixtureServices();
    expect(renderToStaticMarkup(<PhoneAudioScreen />)).toContain("Pro translates videos, calls and podcasts playing on this phone.");
  });

  it("lets Pro listeners straight in", () => {
    state.services = fixtureServices({ features: { history: true, phoneAudio: true } });
    const markup = renderToStaticMarkup(<PhoneAudioScreen />);

    expect(markup).not.toContain("gate");
    expect(markup).not.toContain("free minutes left");
  });
});
