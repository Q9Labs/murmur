import { describe, expect, it, vi } from "vitest";

vi.mock("expo", () => ({
  NativeModule: class {
    emit(): void {}
  },
  registerWebModule: (ModuleClass: new () => unknown) => new ModuleClass(),
}));

import {
  calculatePcm16Rms,
  float32ToPcm16Bytes,
  resampleForRealtime,
} from "./MurmurAudioModule.web";

describe("MurmurAudioModule web audio helpers", () => {
  it("packs float samples into little-endian PCM16 bytes", () => {
    const bytes = float32ToPcm16Bytes(new Float32Array([-1, -0.5, 0, 0.5, 1]));

    expect(Array.from(bytes)).toEqual([
      0x00,
      0x80,
      0x00,
      0xc0,
      0x00,
      0x00,
      0x00,
      0x40,
      0xff,
      0x7f,
    ]);
  });

  it("resamples 48 kHz browser capture to 24 kHz mono frames", () => {
    const input = new Float32Array([0, 0.4, 0.8, 0.4]);
    const output = resampleForRealtime(input, 48_000);

    expect(output[0]).toBeCloseTo(0.2);
    expect(output[1]).toBeCloseTo(0.6);
  });

  it("calculates PCM16 RMS on the same scale as native modules", () => {
    const bytes = float32ToPcm16Bytes(new Float32Array([0.5, -0.5]));

    expect(calculatePcm16Rms(bytes)).toBeCloseTo(0.5, 3);
  });
});
