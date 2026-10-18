import { describe, expect, it } from "vitest";

import { createStartingAudioTracker, translationStartingState } from "./startingState";

describe("translation starting", () => {
  it("shows from live session opening until the first caption, including partial captions", () => {
    expect(translationStartingState(true, false, false)).toBe("starting");
    expect(translationStartingState(true, true, false)).toBeNull();
    expect(translationStartingState(true, true, true)).toBeNull();
    expect(translationStartingState(false, false, false)).toBeNull();
    expect(translationStartingState(false, false, true)).toBeNull();
  });

  it("changes the hint only after 20 seconds of audio and without a caption", () => {
    const audio = createStartingAudioTracker();
    // No clock or session-age timer can advance this state without audio frames.
    expect(translationStartingState(true, false, false)).toBe("starting");
    expect(audio.recordAudio(19_980)).toBe(false);
    expect(audio.recordAudio(20)).toBe(true);
    expect(translationStartingState(true, false, true)).toBe("slow");
    expect(translationStartingState(true, true, true)).toBeNull();
    expect(audio.recordAudio(20)).toBe(false);
  });

  it("does not count capture gaps and resets for the next session", () => {
    const audio = createStartingAudioTracker();
    expect(audio.recordAudio(10_000)).toBe(false);
    // Pausing delivery contributes no duration, regardless of the wall-clock gap.
    expect(audio.recordAudio(9_980)).toBe(false);
    audio.reset();
    expect(audio.recordAudio(20)).toBe(false);
    expect(audio.recordAudio(19_980)).toBe(true);
  });
});
