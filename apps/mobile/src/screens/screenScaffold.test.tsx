import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { router } from "./__tests__/navigation";
import { findControl, recorded, resetRecorded } from "./__tests__/reactNativePrimitives";

vi.mock("react-native", () => import("./__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("expo-router", () => import("./__tests__/navigation").then((m) => m.expoRouterMock));
vi.mock("react-native-safe-area-context", () => import("./__tests__/navigation").then((m) => m.safeAreaMock));
vi.mock("lucide-react-native", () => import("./__tests__/navigation").then((m) => m.lucideMock));

import { PrimaryAction, ScreenScaffold, StatusLine } from "./screenScaffold";

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

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
});
