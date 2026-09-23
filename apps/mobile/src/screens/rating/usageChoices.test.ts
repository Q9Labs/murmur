import { describe, expect, it } from "vitest";

import { usageChoices } from "./usageChoices";

describe("usage choices", () => {
  it("covers every session insight setting, ending with Other", () => {
    expect(usageChoices.map((choice) => choice.value)).toEqual([
      "conference",
      "lecture",
      "travel",
      "business_meeting",
      "medical",
      "legal",
      "education",
      "religious",
      "media",
      "family_social",
      "customer_service",
      "other",
    ]);
  });
});
