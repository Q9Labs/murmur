import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTranslator, UiLocaleContext } from "../../i18n/runtime";
import { previewConversationFor } from "../../home/previewConversation";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("../../home/variants/hooks", () => ({ useReducedMotion: () => true }));
import { PaywallDemo } from "./paywallDemo";

describe("paywall demonstration", () => {
  it("shows the full localized sample immediately with reduced motion", () => {
    const markup = renderToStaticMarkup(<UiLocaleContext.Provider value={{ locale: "ar", direction: "rtl", ready: true, preference: "ar", t: createTranslator("ar"), translate: createTranslator("ar"), setPreference: async () => undefined, deleteLocale: async () => undefined }}><PaywallDemo /></UiLocaleContext.Provider>);
    expect(markup).toContain(previewConversationFor("ar").sourceCaption);
    expect(markup).toContain("مثال: من الإنجليزية إلى العربية");
    expect(markup).toContain("مرحباً، المدينة تبدو مختلفة");
  });
});
