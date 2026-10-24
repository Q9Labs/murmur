import { describe, expect, it } from "vitest";

import nativeState from "../../../../../tooling/ios-capture/tests/capture-failure.json";
import { parseCaptureFailure } from "./captureFailure";

describe("native capture diagnostic boundary", () => {
  it("reads only the allowlisted fields from the native state dictionary", () => {
    expect(parseCaptureFailure({ ...nativeState, capture_failure: {
      ...nativeState.capture_failure, transcript: "private speech", port_name: "private device",
    } })).toEqual(nativeState.capture_failure);
    expect(parseCaptureFailure(new Error("not the native dictionary"))).toBeUndefined();
    expect(parseCaptureFailure({ capture_failure: null })).toBeUndefined();
  });

  it.each([
    { step: "private speech" }, { route: "private device" }, { error_domain: "private URL" },
    { hardware_rate: -1 }, { hardware_rate: Infinity }, { hardware_rate: 384_001 },
    { output_rate: NaN }, { output_rate: "48000" },
    { hardware_channels: 0.5 }, { hardware_channels: 65 }, { output_channels: -1 },
    { voice_processing: "true" }, { error_code: "private" }, { error_code: 2_147_483_648 },
    { error_code: -2_147_483_649 }, { error_code: 1.5 },
  ])("rejects malformed or content-bearing diagnostics: %j", (malicious) => {
    expect(parseCaptureFailure({ capture_failure: { ...nativeState.capture_failure, ...malicious } }))
      .toBeUndefined();
  });
});

const androidFailure = {
  platform: "android", step: "recorder_start", error_domain: "illegal_state",
  error_code: 0, reason: "exception",
};

it("retains Android fields only and does not coerce unsafe values", () => {
  expect(parseCaptureFailure({ capture_failure: { ...androidFailure, message: "private" } }))
    .toEqual(androidFailure);
});

it.each([
  { platform: "private" }, { step: "private" }, { error_domain: "java.private.Class" },
  { reason: "private URL" }, { error_code: "private" }, { error_code: Infinity },
  { error_code: 0.5 }, { error_code: 2_147_483_648 }, { error_code: -2_147_483_649 },
])("rejects unbounded Android diagnostics: %j", (invalid) => {
  expect(parseCaptureFailure({ capture_failure: { ...androidFailure, ...invalid } })).toBeUndefined();
});
