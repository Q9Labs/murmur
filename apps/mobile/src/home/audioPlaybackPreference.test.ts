import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  deleteLocalValue: vi.fn(),
  getLocalValue: vi.fn(),
  setLocalValue: vi.fn(),
}));

vi.mock("../lib/localStorage", () => storage);

import {
  deleteStoredAudioPlaybackEnabled,
  getStoredAudioPlaybackEnabled,
  setStoredAudioPlaybackEnabled,
} from "./audioPlaybackPreference";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("translated audio preference", () => {
  it("defaults to playing translated audio", async () => {
    storage.getLocalValue.mockResolvedValueOnce(null);

    await expect(getStoredAudioPlaybackEnabled()).resolves.toBe(true);
  });

  it("restores a disabled preference", async () => {
    storage.getLocalValue.mockResolvedValueOnce("disabled");

    await expect(getStoredAudioPlaybackEnabled()).resolves.toBe(false);
  });

  it("persists and deletes the preference", async () => {
    await setStoredAudioPlaybackEnabled(false);
    await deleteStoredAudioPlaybackEnabled();

    expect(storage.setLocalValue).toHaveBeenCalledWith(
      "murmur_audio_playback_v1",
      "disabled",
    );
    expect(storage.deleteLocalValue).toHaveBeenCalledWith("murmur_audio_playback_v1");
  });
});
