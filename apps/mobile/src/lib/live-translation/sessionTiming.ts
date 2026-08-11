import type { LatencySample } from "../latency";

export type ListenTimingStep =
  | "microphone_ready"
  | "identity_ready"
  | "integrity_ready"
  | "worker_session_ready"
  | "realtime_provider_ready"
  | "capture_started"
  | "first_source"
  | "first_translation";

export type StopTimingStep =
  | "capture_stopped"
  | "close_requested"
  | "provider_client_closed"
  | "worker_session_close_completed"
  | "playback_cleared_silenced"
  | "ui_ended_start_enabled";

export type SessionTimingTracker = {
  beginListen: (atMs?: number) => void;
  beginStop: (atMs?: number) => void;
  recordListen: (step: ListenTimingStep, atMs?: number) => LatencySample | null;
  recordStop: (step: StopTimingStep, atMs?: number) => LatencySample | null;
};

export function createSessionTimingTracker(now: () => number = Date.now): SessionTimingTracker {
  let listenAtMs: number | null = null;
  let stopAtMs: number | null = null;
  let listenSteps = new Set<ListenTimingStep>();
  let stopSteps = new Set<StopTimingStep>();

  return {
    beginListen(atMs = now()): void {
      listenAtMs = atMs;
      listenSteps = new Set();
    },
    beginStop(atMs = now()): void {
      stopAtMs = atMs;
      stopSteps = new Set();
    },
    recordListen(step, atMs = now()): LatencySample | null {
      if (listenAtMs === null || listenSteps.has(step)) {
        return null;
      }
      listenSteps.add(step);
      return {
        name: `listen_to_${step}`,
        value_ms: Math.max(0, atMs - listenAtMs),
      };
    },
    recordStop(step, atMs = now()): LatencySample | null {
      if (stopAtMs === null || stopSteps.has(step)) {
        return null;
      }
      stopSteps.add(step);
      return {
        name: `stop_to_${step}`,
        value_ms: Math.max(0, atMs - stopAtMs),
      };
    },
  };
}
