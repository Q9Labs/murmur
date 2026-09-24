import { describe, expect, it } from "vitest";

import {
  createCloseMessage,
  createInputAudioMessage,
  createSessionUpdate,
  parseTranslationOutput,
} from "./openaiRealtime";

// cspell:ignore AQID

describe("OpenAI realtime translation adapter", () => {
  it("enables near-field noise reduction only for microphone sessions", () => {
    expect(JSON.parse(createSessionUpdate("pt-BR", "microphone"))).toEqual({
      type: "session.update",
      session: {
        audio: {
          input: { noise_reduction: { type: "near_field" } },
          output: { language: "pt" },
        },
      },
    });
    expect(JSON.parse(createSessionUpdate("zh-Hans", "phone_audio"))).toEqual({
      type: "session.update",
      session: {
        audio: {
          output: { language: "zh" },
        },
      },
    });
  });

  it("enables source transcription only when the flag is on", () => {
    expect(JSON.parse(createSessionUpdate("ar", "microphone", true))).toMatchObject({
      session: {
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: { model: "gpt-realtime-whisper" },
          },
        },
      },
    });
    expect(JSON.parse(createSessionUpdate("ar", "phone_audio", true))).toMatchObject({
      session: {
        audio: {
          input: { transcription: { model: "gpt-realtime-whisper" } },
        },
      },
    });
  });

  it("encodes PCM input and close commands", () => {
    expect(JSON.parse(createInputAudioMessage(new Uint8Array([1, 2, 3]).buffer))).toEqual({
      type: "session.input_audio_buffer.append",
      audio: "AQID",
    });
    expect(JSON.parse(createCloseMessage())).toEqual({ type: "session.close" });
  });

  it("normalizes transcript, audio, lifecycle, and error events", () => {
    expect(parseTranslationOutput(JSON.stringify({
      type: "session.input_transcript.delta",
      delta: "hello",
      elapsed_ms: 1_200,
      event_id: "event_source",
    }))).toEqual({
      kind: "event",
      event: {
        delta: "hello",
        kind: "source_delta",
        provider_elapsed_ms: 1_200,
        provider_event_id: "event_source",
      },
    });
    expect(parseTranslationOutput(JSON.stringify({
      type: "session.output_transcript.delta",
      delta: "مرحبا",
    }))).toEqual({ kind: "event", event: { delta: "مرحبا", kind: "translation_delta" } });
    expect(parseTranslationOutput(JSON.stringify({
      type: "session.output_audio.delta",
      delta: "AQID",
    }))).toEqual({ kind: "audio", pcm16: new Uint8Array([1, 2, 3]).buffer });
    expect(parseTranslationOutput(JSON.stringify({ type: "session.closed" }))).toEqual({
      kind: "event",
      event: { kind: "session_closed" },
    });
    expect(parseTranslationOutput(JSON.stringify({
      type: "session.closed",
      reason: "max_duration_reached",
    }))).toEqual({
      kind: "event",
      event: { kind: "session_closed" },
      providerCloseReason: "max_duration_reached",
    });
    expect(parseTranslationOutput(JSON.stringify({
      type: "session.closed",
      session: { status_details: { reason: "idle_timeout" } },
    }))).toEqual({
      kind: "event",
      event: { kind: "session_closed" },
      providerCloseReason: "idle_timeout",
    });
    expect(parseTranslationOutput(JSON.stringify({
      type: "error",
      error: { code: "rate_limit_exceeded", message: "private provider details" },
    }))).toEqual({
      kind: "event",
      event: {
        code: "provider_rate_limited",
        kind: "session_error",
        retryable: true,
      },
    });
    expect(parseTranslationOutput(JSON.stringify({
      type: "error",
      error: { code: "credit_balance_exhausted", message: "private provider details" },
    }))).toEqual({
      kind: "event",
      event: {
        code: "provider_quota_exhausted",
        kind: "session_error",
        retryable: false,
      },
    });
    expect(parseTranslationOutput(JSON.stringify({
      type: "error",
      error: { code: "unrecognized_private_code" },
    }))).toMatchObject({ event: { code: "provider_error" } });
  });

  it("ignores malformed and unrelated provider messages", () => {
    expect(parseTranslationOutput("not-json")).toEqual({ kind: "ignored" });
    expect(parseTranslationOutput(JSON.stringify({ type: "rate_limits.updated" }))).toEqual({
      kind: "ignored",
    });
  });

  it("sanitizes the effective provider session configuration", () => {
    expect(parseTranslationOutput(JSON.stringify({
      type: "session.updated",
      session: {
        id: "session_openai",
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: { model: "gpt-realtime-whisper" },
          },
          output: { language: "ar" },
        },
      },
    }))).toEqual({
      kind: "event",
      event: {
        input_noise_reduction: "near_field",
        kind: "provider_session_config",
        output_language: "ar",
        phase: "updated",
        provider_session_id: "session_openai",
        transcription_model: "gpt-realtime-whisper",
      },
    });
  });
});
