import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator, UiLocaleContext } from "../../i18n/runtime";
import { previewConversationFor } from "../../home/previewConversation";

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
const motion = vi.hoisted(() => ({ reduced: true as boolean | null, effects: [] as Array<() => void | (() => void)> }));
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useEffect: (effect: () => void | (() => void)) => motion.effects.push(effect) }));
vi.mock("../../home/variants/hooks", () => ({ useReducedMotion: () => motion.reduced }));
beforeEach(() => { motion.reduced = true; motion.effects.length = 0; });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
import { PaywallDemo } from "./paywallDemo";

describe("paywall demonstration", () => {
  it.each([null, true])("does not animate before the motion preference resolves or when reduced (%s)", (reduced) => {
    vi.useFakeTimers();
    motion.reduced = reduced;
    renderToStaticMarkup(<PaywallDemo />);
    motion.effects.splice(0).forEach((effect) => effect());
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ends the reveal on the last word without an extra tick", () => {
    vi.useFakeTimers();
    motion.reduced = false;
    renderToStaticMarkup(<PaywallDemo />);
    const cleanups = motion.effects.splice(0).map((effect) => effect());
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(2000);
    expect(vi.getTimerCount()).toBe(0);
    cleanups.forEach((cleanup) => cleanup?.());
  });
  it("shows the full localized sample immediately with reduced motion", () => {
    const markup = renderToStaticMarkup(<UiLocaleContext.Provider value={{ locale: "ar", direction: "rtl", ready: true, preference: "ar", t: createTranslator("ar"), translate: createTranslator("ar"), setPreference: async () => undefined, deleteLocale: async () => undefined }}><PaywallDemo /></UiLocaleContext.Provider>);
    expect(markup).toContain(previewConversationFor("ar").sourceCaption);
    expect(markup).toContain("مثال: من English إلى العربية");
    expect(markup).toContain("مرحباً، المدينة تبدو مختلفة");
  });
});
