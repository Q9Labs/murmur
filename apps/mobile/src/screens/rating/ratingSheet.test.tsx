import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

vi.mock("../../home/modalSheet", () => import("../../home/__tests__/modalSheetMock"));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));

import { RatingSheet } from "./ratingSheet";

function sendButton() {
  return recorded.controls.find((control) => control.accessibilityRole === "button");
}

beforeEach(() => {
  resetRecorded();
});

describe("rating sheet", () => {
  it("asks for stars and what Murmur was used for, with nothing chosen", () => {
    const markup = renderToStaticMarkup(<RatingSheet onClose={vi.fn()} onSubmit={vi.fn()} open />);

    expect(markup).toContain("How was Murmur?");
    expect(markup).toContain("What did you use Murmur for?");
    expect(recorded.roles.filter((role) => role === "radiogroup")).toHaveLength(2);
    expect(findControl("5 stars")?.accessibilityState?.checked).toBe(false);
    expect(findControl("Conference")?.accessibilityState?.checked).toBe(false);
    expect(findControl("Other")).toBeDefined();
    expect(sendButton()?.disabled).toBe(true);
    expect(recorded.inputs).toHaveLength(0);
  });

  it("sends the answer, with the optional Other text", () => {
    const onSubmit = vi.fn();
    renderToStaticMarkup(
      <RatingSheet
        initialAnswer={{ otherText: "  Parent evening  ", stars: 4, use: "other" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        open
      />,
    );

    expect(findControl("4 stars")?.accessibilityState?.checked).toBe(true);
    expect(recorded.inputs[0]?.accessibilityLabel).toBe("What else did you use Murmur for?");
    sendButton()?.onPress?.();
    expect(onSubmit).toHaveBeenCalledWith({ otherText: "Parent evening", stars: 4, use: "other" });
  });

  it("drops the free text for a listed choice", () => {
    const onSubmit = vi.fn();
    renderToStaticMarkup(
      <RatingSheet initialAnswer={{ otherText: "x", stars: 2, use: "travel" }} onClose={vi.fn()} onSubmit={onSubmit} open />,
    );

    sendButton()?.onPress?.();
    expect(onSubmit).toHaveBeenCalledWith({ otherText: null, stars: 2, use: "travel" });
  });
});
