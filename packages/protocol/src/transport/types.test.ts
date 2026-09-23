import { describe, expectTypeOf, it } from "vitest";

import type {
  CreateSessionRequest,
  CreateSessionResponse,
  RealtimeClientCommand,
} from "./types";

describe("session transport contract", () => {
  it("keeps playback optional for existing app versions", () => {
    expectTypeOf<CreateSessionRequest["playback_enabled"]>().toEqualTypeOf<boolean | undefined>();
  });

  it("requires the source-transcript capability in session responses", () => {
    expectTypeOf<CreateSessionResponse["features"]>().toEqualTypeOf<{ source_transcript: boolean }>();
  });

  it("accepts an explicit playback toggle on the realtime socket", () => {
    expectTypeOf<Extract<RealtimeClientCommand, { kind: "set_playback" }>>()
      .toEqualTypeOf<{ enabled: boolean; kind: "set_playback" }>();
  });
});
