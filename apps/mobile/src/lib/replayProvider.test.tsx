import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("posthog-react-native", () => ({
  PostHogProvider: ({ children }: { children: ReactNode }) => <div data-replay>{children}</div>,
}));
vi.mock("./replay", () => ({
  initializeReplay: vi.fn(async () => null),
  subscribeReplay: vi.fn(() => () => undefined),
}));

import { ReplayProvider } from "./replayProvider";

describe("replay provider", () => {
  it("does not start recording before the analytics preference has loaded", () => {
    const html = renderToStaticMarkup(<ReplayProvider><span>Private view</span></ReplayProvider>);
    expect(html).toBe("<span>Private view</span>");
  });
});
