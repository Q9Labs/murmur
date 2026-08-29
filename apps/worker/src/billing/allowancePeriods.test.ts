import { describe, expect, it } from "vitest";

import {
  currentProAllowancePeriod,
  freeAllowancePeriod,
  proAllowancePeriod,
} from "./allowancePeriods";

describe("allowance periods", () => {
  it("uses exact UTC calendar months for Free", () => {
    expect(freeAllowancePeriod(Date.UTC(2026, 7, 29, 23, 59))).toEqual({
      expiresAtMs: Date.UTC(2026, 8, 1),
      periodKey: "free:2026-08",
      startsAtMs: Date.UTC(2026, 7, 1),
    });
  });

  it("clamps annual internal cycles without drifting the anchor", () => {
    const anchorAtMs = Date.UTC(2024, 0, 31, 12, 34, 56, 789);
    expect(
      proAllowancePeriod({ anchorAtMs, cycleIndex: 0, episodeId: "episode" }),
    ).toEqual({
      expiresAtMs: Date.UTC(2024, 1, 29, 12, 34, 56, 789),
      periodKey: "pro:episode:0",
      startsAtMs: anchorAtMs,
    });
    expect(
      proAllowancePeriod({ anchorAtMs, cycleIndex: 1, episodeId: "episode" }),
    ).toEqual({
      expiresAtMs: Date.UTC(2024, 2, 31, 12, 34, 56, 789),
      periodKey: "pro:episode:1",
      startsAtMs: Date.UTC(2024, 1, 29, 12, 34, 56, 789),
    });
  });

  it("rejects an invalid cycle", () => {
    expect(() =>
      proAllowancePeriod({ anchorAtMs: 0, cycleIndex: -1, episodeId: "episode" }),
    ).toThrow(RangeError);
  });

  it("finds the current internal month for an annual subscription", () => {
    expect(currentProAllowancePeriod({
      anchorAtMs: Date.UTC(2026, 0, 31, 12),
      episodeId: "annual_1",
      nowMs: Date.UTC(2026, 2, 15),
    })).toEqual({
      expiresAtMs: Date.UTC(2026, 2, 31, 12),
      periodKey: "pro:annual_1:1",
      startsAtMs: Date.UTC(2026, 1, 28, 12),
    });
  });
});
