const slowStartingAudioMs = 20_000;

export function translationStartingState(isLive: boolean, hasCaption: boolean, slow: boolean): "starting" | "slow" | null {
  if (!isLive || hasCaption) return null;
  return slow ? "slow" : "starting";
}

export function createStartingAudioTracker(): {
  recordAudio: (durationMs: number) => boolean;
  reset: () => void;
} {
  let audioMs = 0;
  return {
    recordAudio(durationMs) {
      const previousMs = audioMs;
      audioMs += durationMs;
      return previousMs < slowStartingAudioMs && audioMs >= slowStartingAudioMs;
    },
    reset() {
      audioMs = 0;
    },
  };
}
