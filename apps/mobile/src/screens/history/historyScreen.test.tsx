import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "../__tests__/navigation";
import { recorded, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureConversation, fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";

const state = vi.hoisted(() => ({ services: null as ScreenServices | null }));

vi.mock("posthog-react-native", () => ({
  PostHogMaskView: (props: { children: ReactNode }) => <section data-replay-mask="">{props.children}</section>,
}));
vi.mock("../../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("../proGate", () => ({ ProGate: (props: { title: string }) => <p>gate {props.title}</p> }));
vi.mock("../screenServices", () => ({ useScreenServices: () => state.services }));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { HistoryScreen } from "./historyScreen";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

describe("history screen", () => {
  it("gates free listeners", () => {
    state.services = fixtureServices({ conversations: [fixtureConversation] });
    expect(renderToStaticMarkup(<HistoryScreen />)).toContain("gate Conversation history");
  });

  it("lists conversations newest first and opens one", () => {
    const older = { ...fixtureConversation, id: "older", startedAtMs: fixtureConversation.startedAtMs - 86_400_000, text: "Older" };
    state.services = fixtureServices({
      conversations: [older, fixtureConversation],
      features: { history: true, phoneAudio: true },
    });
    const markup = renderToStaticMarkup(<HistoryScreen />);

    expect(markup.indexOf("Welcome to the conference")).toBeLessThan(markup.indexOf("Older"));
    expect(markup).toContain("Arabic to English · 12 min");
    recorded.controls[0]?.onPress?.();
    expect(router.push).toHaveBeenCalledWith({ params: { id: "conversation-1" }, pathname: "/history/[id]" });
  });

  it("explains where conversations will go when there are none", () => {
    state.services = fixtureServices({ features: { history: true, phoneAudio: false } });
    expect(renderToStaticMarkup(<HistoryScreen />)).toContain("on this phone only");
  });
});
