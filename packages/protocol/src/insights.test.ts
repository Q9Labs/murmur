import { describe, expect, it } from "vitest";

import { insightSettings, isInsightSetting } from "./insights";

describe("insight settings", () => {
  it("accepts the complete survey vocabulary and rejects free-form text", () => {
    expect(insightSettings).toContain("conference");
    expect(insightSettings).toContain("other");
    expect(insightSettings).toHaveLength(12);
    expect(isInsightSetting("business_meeting")).toBe(true);
    expect(isInsightSetting("my private meeting")).toBe(false);
  });
});
