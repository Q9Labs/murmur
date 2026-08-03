import { describe, expect, it } from "vitest";

import {
  createCloseMessage,
  createInputAudioMessage,
  createSessionUpdate,
  parseTranslationOutput,
} from "./openaiRealtime";

// cspell:ignore AQID

describe("OpenAI realtime translation adapter", () => {
  it("maps Murmur session settings to OpenAI translation settings", () => {
    expect(JSON.parse(createSessionUpdate("pt-BR"))).toEqual({
      type: "session.update",
      session: {
        audio: {
          input: { transcription: { model: "gpt-realtime-whisper" } },
          output: { language: "pt" },
        },
      },
    });
    expect(JSON.parse(createSessionUpdate("zh-Hans"))).toEqual({
      type: "session.update",
      session: {
        audio: {
          input: { transcription: { model: "gpt-realtime-whisper" } },
          output: { language: "zh" },
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
    }))).toEqual({ kind: "event", event: { delta: "hello", kind: "source_delta" } });
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
      type: "error",
      error: { code: "rate_limit_exceeded", message: "private provider details" },
    }))).toEqual({
      kind: "event",
      event: {
        code: "rate_limit_exceeded",
        kind: "session_error",
        retryable: true,
      },
    });
  });

  it("ignores malformed and unrelated provider messages", () => {
    expect(parseTranslationOutput("not-json")).toEqual({ kind: "ignored" });
    expect(parseTranslationOutput(JSON.stringify({ type: "session.created" }))).toEqual({
      kind: "ignored",
    });
  });
});
