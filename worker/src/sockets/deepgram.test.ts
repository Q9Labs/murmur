import { describe, expect, it } from "vitest";

import { buildDeepgramListenUrl } from "./deepgram";

describe("Deepgram socket helpers", () => {
  it("builds listen URLs for explicit and auto source languages", () => {
    const englishUrl = new URL(buildDeepgramListenUrl("en"));
    const autoUrl = new URL(buildDeepgramListenUrl("auto"));

    expect(englishUrl.origin).toBe("wss://api.deepgram.com");
    expect(englishUrl.pathname).toBe("/v1/listen");
    expect(englishUrl.searchParams.get("model")).toBe("nova-3");
    expect(englishUrl.searchParams.get("encoding")).toBe("linear16");
    expect(englishUrl.searchParams.get("sample_rate")).toBe("16000");
    expect(englishUrl.searchParams.get("language")).toBe("en");
    expect(autoUrl.searchParams.get("language")).toBe("multi");
  });
});
