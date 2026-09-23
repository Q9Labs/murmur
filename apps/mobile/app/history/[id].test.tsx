import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: ["conversation-1"] }) }));
vi.mock("../../src/screens/history/conversationScreen", () => ({
  ConversationScreen: (props: { id?: string }) => <p>conversation {props.id}</p>,
}));

import ConversationRoute from "./[id]";

describe("conversation route", () => {
  it("opens the conversation named in the link", () => {
    expect(renderToStaticMarkup(<ConversationRoute />)).toContain("conversation-1");
  });
});
