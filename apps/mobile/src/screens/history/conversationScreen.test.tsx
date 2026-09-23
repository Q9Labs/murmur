import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "../__tests__/navigation";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";
import { fixtureConversation, fixtureServices } from "../__tests__/servicesFixture";
import type { ScreenServices } from "../screenServices";

const state = vi.hoisted(() => ({ services: null as ScreenServices | null }));
const native = vi.hoisted(() => ({
  copy: vi.fn(async () => true),
}));

vi.mock("../proGate", () => ({ ProGate: (props: { title: string }) => <p>gate {props.title}</p> }));
vi.mock("expo-clipboard", () => ({ setStringAsync: native.copy }));
vi.mock("../../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("../screenServices", () => ({ useScreenServices: () => state.services }));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("expo-router", () => import("../__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));

import { ConversationScreen } from "./conversationScreen";

const pro = { history: true, phoneAudio: true };

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  state.services = fixtureServices({ conversations: [fixtureConversation], features: pro });
});

describe("conversation screen", () => {
  it("shows the translation and shares or copies it", async () => {
    const markup = renderToStaticMarkup(<ConversationScreen id="conversation-1" />);

    expect(markup).toContain("Welcome to the conference");
    expect(markup).toContain("Arabic to English · 12 min");
    findControl("Share")?.onPress?.();
    expect(state.services?.shareConversation).toHaveBeenCalledWith(fixtureConversation.id);
    findControl("Copy")?.onPress?.();
    await vi.waitFor(() => expect(native.copy).toHaveBeenCalledWith(fixtureConversation.text));
  });

  it("deletes only after confirming", async () => {
    renderToStaticMarkup(<ConversationScreen id="conversation-1" />);
    findControl("Delete")?.onPress?.();

    expect(state.services?.deleteConversation).not.toHaveBeenCalled();
    recorded.alerts[0]?.buttons.find((button) => button.style === "destructive")?.onPress?.();
    expect(state.services?.deleteConversation).toHaveBeenCalledWith("conversation-1");
    await vi.waitFor(() => expect(router.back).toHaveBeenCalledOnce());
  });

  it("handles a missing conversation and the Pro gate", () => {
    expect(renderToStaticMarkup(<ConversationScreen id="gone" />)).toContain("no longer on this phone");
    state.services = fixtureServices({ conversations: [fixtureConversation] });
    expect(renderToStaticMarkup(<ConversationScreen id="conversation-1" />)).toContain("gate Conversation history");
  });
});
