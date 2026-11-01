import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "./__tests__/navigation";
import { findControl, recorded, resetRecorded, testWindow } from "./__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("./__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("./__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native-safe-area-context", () => import("./__tests__/navigation").then((m) => m.safeAreaMock));
vi.mock("lucide-react-native", () => import("./__tests__/navigation").then((m) => m.lucideMock));

import { PrimaryAction, QuietAction, ScreenScaffold, SecondaryAction, StatusLine } from "./screenScaffold";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
  testWindow.height = 844;
  testWindow.width = 390;
});

function flattenStyle(style: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map((entry) => flattenStyle(entry)));
  }
  return (style as Record<string, unknown>) ?? undefined;
}

describe("screen scaffold", () => {
  it("shows the title, content and footer with a working back button", () => {
    const markup = renderToStaticMarkup(
      <ScreenScaffold footer={<p>footer</p>} title="Plans">
        <p>content</p>
      </ScreenScaffold>,
    );

    expect(markup).toContain("Plans");
    expect(markup).toContain("content");
    expect(markup).toContain("footer");
    findControl("Back")?.onPress?.();
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("keeps the footer at its intrinsic height so every action stays reachable", () => {
    renderToStaticMarkup(
      <ScreenScaffold footer={<p>footer</p>} title="Consent">
        <p>content</p>
      </ScreenScaffold>,
    );

    // Layout contract: the footer's own scroll track never shrinks below its
    // content height (bounded by the screen cap), so a short screen can no
    // longer push secondary actions below the fold.
    const footerTrack = recorded.scrollViews.at(-1)?.style as { flexShrink?: number; maxHeight?: string } | undefined;
    expect(footerTrack?.flexShrink).toBe(0);
    expect(footerTrack?.maxHeight).toBe("60%");
  });

  it("prioritizes the question over ornamental art on short screens", () => {
    testWindow.height = 544;
    testWindow.width = 384;
    renderToStaticMarkup(
      <ScreenScaffold artwork={1} footer={<p>footer</p>} lead="lead" title="Help improve Murmur">
        <p>points</p>
      </ScreenScaffold>,
    );

    // Contract: the hero body top-aligns and the artwork shrinks so the title,
    // lead and disclosure content reach the first paint with the actions —
    // the same surface's metrics stay untouched on tall screens.
    const body = recorded.scrollViews.at(0)?.contentContainerStyle;
    expect(flattenStyle(body)?.justifyContent).toBe("flex-start");
    const art = flattenStyle(recorded.images.at(0)?.style);
    expect(art?.height).toBe(96);
  });

  it("keeps the centred full-size hero on tall screens", () => {
    renderToStaticMarkup(
      <ScreenScaffold artwork={1} footer={<p>footer</p>} lead="lead" title="Help improve Murmur">
        <p>points</p>
      </ScreenScaffold>,
    );

    const body = recorded.scrollViews.at(0)?.contentContainerStyle;
    expect(flattenStyle(body)?.justifyContent).toBe("center");
    const art = flattenStyle(recorded.images.at(0)?.style);
    expect(art?.height).toBe(168);
  });

  it("goes home when there is nothing to go back to", () => {
    router.canGoBack.mockReturnValueOnce(false);
    renderToStaticMarkup(<ScreenScaffold title="Settings"><p>content</p></ScreenScaffold>);

    findControl("Back")?.onPress?.();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("renders the primary action and status lines", () => {
    const onPress = vi.fn();
    const markup = renderToStaticMarkup(
      <>
        <PrimaryAction label="Get more time" onPress={onPress} />
        <StatusLine error="Store is down." notice="Purchase verified." />
      </>,
    );

    expect(markup).toContain("Store is down.");
    expect(markup).toContain("Purchase verified.");
    recorded.controls.find((control) => control.accessibilityRole === "button")?.onPress?.();
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("renders secondary and quiet actions", () => {
    const yes = vi.fn();
    const skip = vi.fn();
    const markup = renderToStaticMarkup(
      <>
        <SecondaryAction disabled label="Yes" onPress={yes} />
        <QuietAction label="Not now" onPress={skip} />
      </>,
    );

    expect(markup).toContain("Yes");
    expect(markup).toContain("Not now");
    const [first, second] = recorded.controls;
    expect(first?.accessibilityState?.disabled).toBe(true);
    second?.onPress?.();
    expect(skip).toHaveBeenCalledOnce();
  });
});
