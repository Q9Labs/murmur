import { describe, expect, it } from "vitest";

import { ContinuousSpanStabilizer } from "./continuousStabilizer";

describe("ContinuousSpanStabilizer", () => {
  it("emits stable prefixes at sentence boundaries during ongoing speech", () => {
    const stabilizer = new ContinuousSpanStabilizer({
      minChunkSourceChars: 12,
      maxChunkSourceChars: 120,
    });

    expect(stabilizer.acceptTranscript("Hello how are you doing")).toEqual([
      { source_caption: "Hello how are you doing" },
    ]);
    expect(stabilizer.acceptTranscript("Hello how are you doing today we are starting. Next topic")).toEqual([
      { source_caption: "today we are starting." },
    ]);
  });

  it("does not emit duplicate text when interim transcripts grow", () => {
    const stabilizer = new ContinuousSpanStabilizer({
      minChunkSourceChars: 10,
      maxChunkSourceChars: 120,
    });

    expect(stabilizer.acceptTranscript("Good morning everyone")).toEqual([
      { source_caption: "Good morning everyone" },
    ]);
    expect(stabilizer.acceptTranscript("Good morning everyone welcome back")).toEqual([
      { source_caption: "welcome back" },
    ]);
    expect(stabilizer.acceptTranscript("Good morning everyone welcome back")).toEqual([]);
  });

  it("flushes the remaining unstable tail when forced", () => {
    const stabilizer = new ContinuousSpanStabilizer({
      minChunkSourceChars: 40,
      maxChunkSourceChars: 120,
    });

    expect(stabilizer.acceptTranscript("Short tail")).toEqual([]);
    expect(stabilizer.acceptTranscript("Short tail", true)).toEqual([
      { source_caption: "Short tail" },
    ]);
  });

  it("can reset between provider transcript segments", () => {
    const stabilizer = new ContinuousSpanStabilizer({
      minChunkSourceChars: 10,
      maxChunkSourceChars: 120,
    });

    expect(stabilizer.acceptTranscript("Good morning everyone", true)).toEqual([
      { source_caption: "Good morning everyone" },
    ]);

    expect(stabilizer.acceptTranscript("Next topic starts")).toEqual([]);
    stabilizer.reset();

    expect(stabilizer.acceptTranscript("Next topic starts")).toEqual([
      { source_caption: "Next topic starts" },
    ]);
  });

  it("returns only the live un-emitted tail", () => {
    const stabilizer = new ContinuousSpanStabilizer({
      minChunkSourceChars: 12,
      maxChunkSourceChars: 120,
    });

    expect(stabilizer.acceptTranscript("Hello how are you doing today")).toEqual([
      { source_caption: "Hello how are you doing today" },
    ]);
    expect(stabilizer.getUnemittedText("Hello how are you doing today with the next point")).toBe(
      "with the next point",
    );
  });
});
