import { describe, expect, it } from "vitest";

import {
  canStartSession,
  createSession,
  createSpan,
  isActiveOrRecoveringSession,
  nextEventSeq,
  selectContextSpans,
  shouldAcceptDeepgramEvent,
  shouldAcceptTranslationEvent,
  type TranslationSpan,
} from "./session";

describe("selectContextSpans", () => {
  it("returns only the previous 10 committed stable spans", () => {
    const spans: TranslationSpan[] = Array.from({ length: 13 }, (_, index) => ({
      ...createSpan(`source ${index}`),
      span_id: `span_${index}`,
      status: index === 2 ? "failed" : "committed",
      translated_caption: `target ${index}`,
    }));

    const context = selectContextSpans(spans);

    expect(context).toHaveLength(10);
    expect(context.map((span) => span.span_id)).toEqual([
      "span_3",
      "span_4",
      "span_5",
      "span_6",
      "span_7",
      "span_8",
      "span_9",
      "span_10",
      "span_11",
      "span_12",
    ]);
  });
});

describe("session lifecycle guards", () => {
  it("allows start only from clean terminal states", () => {
    expect(canStartSession("idle")).toBe(true);
    expect(canStartSession("ended")).toBe(true);
    expect(canStartSession("failed")).toBe(true);
    expect(canStartSession("creating_session")).toBe(false);
    expect(canStartSession("live")).toBe(false);
    expect(canStartSession("stopping")).toBe(false);
    expect(canStartSession("cancelling")).toBe(false);
  });

  it("treats partial-start and live states as teardown-capable", () => {
    expect(isActiveOrRecoveringSession("requesting_mic_permission")).toBe(true);
    expect(isActiveOrRecoveringSession("creating_session")).toBe(true);
    expect(isActiveOrRecoveringSession("connecting_deepgram")).toBe(true);
    expect(isActiveOrRecoveringSession("connecting_translate_ws")).toBe(true);
    expect(isActiveOrRecoveringSession("live")).toBe(true);
    expect(isActiveOrRecoveringSession("transport_disconnected")).toBe(true);
    expect(isActiveOrRecoveringSession("idle")).toBe(false);
    expect(isActiveOrRecoveringSession("ended")).toBe(false);
    expect(isActiveOrRecoveringSession("failed")).toBe(false);
  });

  it("accepts Deepgram events only while setup/live can consume them", () => {
    expect(shouldAcceptDeepgramEvent("connecting_deepgram")).toBe(true);
    expect(shouldAcceptDeepgramEvent("connecting_translate_ws")).toBe(true);
    expect(shouldAcceptDeepgramEvent("live")).toBe(true);
    expect(shouldAcceptDeepgramEvent("stopping")).toBe(false);
    expect(shouldAcceptDeepgramEvent("cancelling")).toBe(false);
    expect(shouldAcceptDeepgramEvent("ended")).toBe(false);
  });

  it("rejects stale translation events from the wrong session or epoch", () => {
    const session = createSession({ source_language: "en", target_language: "ar" });
    const liveSession = {
      ...session,
      identity: {
        ...session.identity,
        app_session_id: "session_current",
        connection_id: "connection_current",
        session_epoch: 3,
      },
      state: "live" as const,
    };

    expect(
      shouldAcceptTranslationEvent(liveSession, {
        app_session_id: "session_current",
        connection_id: "connection_current",
        session_epoch: 3,
      }),
    ).toBe(true);
    expect(
      shouldAcceptTranslationEvent(liveSession, {
        app_session_id: "session_current",
        connection_id: "connection_previous",
        session_epoch: 3,
      }),
    ).toBe(false);
    expect(
      shouldAcceptTranslationEvent(liveSession, {
        app_session_id: "session_previous",
        session_epoch: 3,
      }),
    ).toBe(false);
    expect(
      shouldAcceptTranslationEvent(liveSession, {
        app_session_id: "session_current",
        session_epoch: 2,
      }),
    ).toBe(false);
    expect(shouldAcceptTranslationEvent({ ...liveSession, state: "ended" }, {
      app_session_id: "session_current",
      session_epoch: 3,
    })).toBe(false);
  });

  it("increments event sequence without changing session identity", () => {
    const session = createSession({ source_language: "en", target_language: "ar" });
    const next = nextEventSeq(session);

    expect(next.identity.event_seq).toBe(session.identity.event_seq + 1);
    expect(next.identity.app_session_id).toBe(session.identity.app_session_id);
    expect(next.identity.connection_id).toBe(session.identity.connection_id);
    expect(next.identity.session_epoch).toBe(session.identity.session_epoch);
  });
});
