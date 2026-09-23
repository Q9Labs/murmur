import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => import("../../../screens/__tests__/reactNativePrimitives").then((m) => ({
  ...m.reactNativePrimitives,
  AppState: { addEventListener: () => ({ remove: vi.fn() }), currentState: "background" },
})));

import { BackgroundListeningPill, isAppInBackground, useAppInBackground } from "./backgroundListening";

function Probe() {
  return <p>{useAppInBackground() ? "background" : "active"}</p>;
}

describe("background listening", () => {
  it("treats anything but active as the background", () => {
    expect(isAppInBackground("active")).toBe(false);
    expect(isAppInBackground("background")).toBe(true);
    expect(isAppInBackground("inactive")).toBe(true);
    expect(renderToStaticMarkup(<Probe />)).toContain("background");
  });

  it("says the session is still listening", () => {
    expect(renderToStaticMarkup(<BackgroundListeningPill />)).toContain("Listening in background");
  });
});
