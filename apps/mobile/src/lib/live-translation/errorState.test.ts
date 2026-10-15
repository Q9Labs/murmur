import { describe, expect, it } from "vitest";

import { formatLiveError } from "../../home/errorCopy";
import {
  preserveFirstLiveError,
  sessionErrorOutcome,
  shouldIgnoreLateTransportEvent,
} from "./errorState";

describe("live error precedence", () => {
  it.each(["session_expired", "session_silence_timeout", "allowance_exhausted", "phone_audio_gift_exhausted"])(
    "classifies the enforced %s as an expected end without hiding its copy",
    (code) => {
      expect(sessionErrorOutcome(code)).toBe("ended");
      expect(preserveFirstLiveError(null, `realtime_${code}`)).toBe(`realtime_${code}`);
    },
  );

  it.each(["provider_transport_closed", "provider_quota_exhausted", "billing_unavailable", "unknown"])(
    "keeps %s a failure",
    (code) => expect(sessionErrorOutcome(code)).toBe("failed"),
  );
  it("keeps the silence copy when a transport error follows the server session error", () => {
    const sessionError = preserveFirstLiveError(null, "realtime_session_silence_timeout");
    const finalError = preserveFirstLiveError(sessionError, "realtime_transport_error");

    expect(formatLiveError(finalError)).toContain("two minutes without speech");
    expect(shouldIgnoreLateTransportEvent(finalError, "failed")).toBe(true);
  });

  it("shows the transport copy when transport error is the first error", () => {
    const error = preserveFirstLiveError(null, "realtime_transport_error");

    expect(formatLiveError(error)).toContain("Translation connection was interrupted");
    expect(shouldIgnoreLateTransportEvent(null, "live")).toBe(false);
  });

  it("ignores transport endings after the session is already terminal", () => {
    expect(shouldIgnoreLateTransportEvent(null, "failed")).toBe(true);
    expect(shouldIgnoreLateTransportEvent(null, "ended")).toBe(true);
    expect(shouldIgnoreLateTransportEvent(null, "cancelling")).toBe(true);
  });
});
