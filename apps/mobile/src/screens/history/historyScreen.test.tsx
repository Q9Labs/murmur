import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureConversation, fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";

const state = vi.hoisted(() => ({ services: null as ScreenServices | null }));

vi.mock("posthog-react-native", () => ({
  PostHogMaskView: (props: { children: ReactNode }) => <section data-replay-mask="">{props.children}</section>,
}));
vi.mock("../../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("../proGate", () => ({
  ProGate: (props: { children?: ReactNode; title: string }) => (
    <section data-pro-gate="">
      <p>gate {props.title}</p>
      {props.children}
    </section>
  ),
}));
vi.mock("../screenServices", () => ({ useScreenServices: () => state.services }));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("../../home/illustrations", () => ({ conversationHistoryIllustration: 1 }));
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
    expect(renderToStaticMarkup(<HistoryScreen />)).toContain("gate Keep every conversation");
  });

  it("keeps old local entries deletable without exposing their translation after Pro expires", async () => {
    state.services = fixtureServices({
      conversations: [{ ...fixtureConversation, canView: false, text: "" }],
    });
    const markup = renderToStaticMarkup(<HistoryScreen />);

    expect(markup).toContain("gate Keep every conversation");
    expect(markup).not.toContain("Welcome to the conference");
    expect(findControl("Delete")).toBeDefined();
    findControl("Delete")?.onPress?.();
    recorded.alerts[0]?.buttons.find((button) => button.style === "destructive")?.onPress?.();
    await vi.waitFor(() => expect(state.services?.deleteConversation).toHaveBeenCalledWith("conversation-1"));
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
    const markup = renderToStaticMarkup(<HistoryScreen />);

    expect(markup).toContain("No conversations yet");
    expect(markup).toContain("When you stop translating, the conversation is saved here, on this phone only.");
  });
});
