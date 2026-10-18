import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const animation = vi.hoisted(() => ({ active: false, reducedMotion: true }));
vi.mock("react-native", () => import("../../../screens/__tests__/reactNativePrimitives").then((m) => ({
  ...m.reactNativePrimitives,
  Animated: { View: m.reactNativePrimitives.View },
})));
vi.mock("../hooks", () => ({
  useReducedMotion: () => animation.reducedMotion,
  usePulse: (active: boolean) => {
    animation.active = active;
    return { interpolate: () => 1 };
  },
}));

import { TranslationStarting } from "./translationStarting";

beforeEach(() => { animation.reducedMotion = true; });

describe("starting indicator", () => {
  it("asks for playback instead of microphone proximity for phone audio", () => {
    const markup = renderToStaticMarkup(<TranslationStarting slow={false} phoneAudio />);
    expect(markup).toContain("Play audio in another app.");
    expect(markup).not.toContain("Keep the phone near the speaker.");
  });

  it("keeps a static indicator under reduced motion", () => {
    const markup = renderToStaticMarkup(<TranslationStarting slow={false} />);
    expect(animation.active).toBe(false);
    expect(markup).toContain("Translation is starting…");
    expect(markup).toContain("Keep the phone near the speaker.");
    expect(markup).not.toContain("Still starting.");
  });

  it("animates without reduced motion and shows the honest longer-wait hint", () => {
    animation.reducedMotion = false;
    const markup = renderToStaticMarkup(<TranslationStarting slow />);
    expect(animation.active).toBe(true);
    expect(markup).toContain("Still starting. This can take a moment.");
    expect(markup).not.toContain("Keep the phone near the speaker.");
  });
});
