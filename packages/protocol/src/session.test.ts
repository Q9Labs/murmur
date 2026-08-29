import { describe, expect, it } from "vitest";

import {
  canStartSession,
  createConnectionId,
  createSession,
  createSpan,
  isActiveOrRecoveringSession,
} from "./session";

describe("session lifecycle", () => {
  it("creates an app-facing realtime session", () => {
    const session = createSession({ source_language: "en", target_language: "ar" });

    expect(session).toMatchObject({
      source_language: "en",
      state: "idle",
      target_language: "ar",
    });
    expect(session.identity.app_session_id).toMatch(/^session_/);
  });

  it("allows start only from clean terminal states", () => {
    expect(canStartSession("idle")).toBe(true);
    expect(canStartSession("ended")).toBe(true);
    expect(canStartSession("failed")).toBe(true);
    expect(canStartSession("connecting_realtime")).toBe(false);
    expect(canStartSession("live")).toBe(false);
    expect(canStartSession("stopping")).toBe(false);
  });

  it("treats setup, live, and recovery states as teardown-capable", () => {
    expect(isActiveOrRecoveringSession("requesting_mic_permission")).toBe(true);
    expect(isActiveOrRecoveringSession("checking_device")).toBe(true);
    expect(isActiveOrRecoveringSession("creating_session")).toBe(true);
    expect(isActiveOrRecoveringSession("connecting_realtime")).toBe(true);
    expect(isActiveOrRecoveringSession("live")).toBe(true);
    expect(isActiveOrRecoveringSession("network_degraded")).toBe(true);
    expect(isActiveOrRecoveringSession("idle")).toBe(false);
    expect(isActiveOrRecoveringSession("ended")).toBe(false);
    expect(isActiveOrRecoveringSession("failed")).toBe(false);
  });

  it("creates an empty translating span", () => {
    expect(createSpan()).toMatchObject({
      committed_translated_caption: null,
      partial_translated_caption: null,
      revision: 1,
      source_caption: "",
      status: "translating",
      translated_caption: "",
    });
  });

  it("creates distinct connection identifiers", () => {
    expect(createConnectionId()).not.toBe(createConnectionId());
  });
});
