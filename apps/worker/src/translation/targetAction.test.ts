import { describe, expect, it } from "vitest";

import {
  parseInterpreterTargetAction,
  parsePreviewTargetAction,
  parseStreamingInterpreterTargetAction,
  parseStreamingPreviewTargetAction,
} from "./targetAction";

describe("target action parsing", () => {
  it("parses interpreter target actions while preserving target text only", () => {
    expect(parseStreamingInterpreterTargetAction("COM")).toEqual({ action: "pending" });
    expect(parseStreamingInterpreterTargetAction("COMMIT\nمرحبا")).toEqual({
      action: "commit",
      translated_caption: "مرحبا",
    });
    expect(parseInterpreterTargetAction("WAIT: needs an object")).toEqual({
      action: "wait",
      reason: "needs an object",
    });
  });

  it("parses W/C preview target actions while preserving draft text only", () => {
    expect(parseStreamingPreviewTargetAction("C")).toEqual({
      action: "pending",
    });
    expect(parsePreviewTargetAction("C")).toEqual({
      action: "commit",
      translated_caption: "",
    });
    expect(parseStreamingPreviewTargetAction("C\nمرحبا")).toEqual({
      action: "commit",
      translated_caption: "مرحبا",
    });
    expect(parsePreviewTargetAction("W: needs object")).toEqual({
      action: "wait",
      reason: "needs object",
    });
    expect(parsePreviewTargetAction("COMMIT\nمرحبا")).toEqual({
      action: "commit",
      translated_caption: "مرحبا",
    });
  });
});
