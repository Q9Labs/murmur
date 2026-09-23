import { describe, expect, it } from "vitest";

import { phoneAudioAccess } from "./phoneAudioAccess";

const free = { history: false, phoneAudio: false };
const pro = { history: true, phoneAudio: true };

describe("phone audio access", () => {
  it("offers the gift to free listeners who have not claimed it", () => {
    expect(phoneAudioAccess(free, { claimable: true, remainingMs: 0 })).toBe("gift_claimable");
  });

  it("shows the claimed gift while its time lasts", () => {
    expect(phoneAudioAccess({ ...free, phoneAudio: true }, { claimable: false, remainingMs: 95_000 })).toBe("gift_active");
  });

  it("gates free listeners without a gift, and lets Pro straight in", () => {
    expect(phoneAudioAccess(free, { claimable: false, remainingMs: 0 })).toBe("locked");
    expect(phoneAudioAccess(pro, { claimable: true, remainingMs: 0 })).toBe("included");
  });
});
