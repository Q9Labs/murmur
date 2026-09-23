import { describe, expect, it } from "vitest";

import {
  type MobileFailureStage,
  type MobileTelemetryEvent,
  parseMobileTelemetryEvent,
  parseMobileTelemetryRequest,
  type TelemetryPlatform,
} from "./telemetry";

const sessionId = "session_12345678";

const validEvents: MobileTelemetryEvent[] = [
  {
    app_version: "1.2.0",
    build_number: "10",
    event: "mobile_app_opened",
    platform: "ios",
  },
  {
    app_version: "1.2.0",
    build_number: "4",
    event: "mobile_onboarding_completed",
    platform: "android",
  },
  {
    app_version: "1.2.0",
    build_number: "web",
    enabled: true,
    event: "mobile_analytics_preference_changed",
    platform: "web",
  },
  {
    event: "mobile_listen_tapped",
    network_type: "WIFI",
    playback_enabled: true,
    source_language: "en",
    target_language: "ar",
  },
  {
    app_session_id: sessionId,
    event: "mobile_session_live",
    source_language: "en",
    startup_latency_ms: 250,
    target_language: "ar",
  },
  {
    app_session_id: sessionId,
    event: "mobile_first_translation",
    first_translation_latency_ms: 900,
    provider_elapsed_ms: null,
  },
  {
    app_session_id: null,
    duration_ms: 50,
    error_code: "microphone_permission_denied",
    event: "mobile_session_failed",
    failure_stage: "microphone_permission",
    source_language: "en",
    target_language: "ar",
  },
  {
    app_session_id: sessionId,
    committed_translation: true,
    backgrounded: true,
    capture_source: "microphone",
    duration_ms: 61_000,
    error_code: null,
    event: "mobile_session_completed",
    input_audio_bytes: 240_000,
    input_audio_frames: 120,
    network_type: "WIFI",
    outcome: "completed",
    playback_enabled: true,
    source_char_count: 42,
    source_language: "en",
    target_language: "ar",
    translated_char_count: 51,
  },
  {
    app_session_id: sessionId,
    error_category: "inaccurate",
    event: "mobile_translation_reported",
  },
  {
    app_version: "1.2.3",
    backend_environment: "sandbox",
    build_number: "14",
    event: "mobile_checkout_succeeded",
    package_label: "store_paywall",
    platform: "ios",
    result_category: "purchased",
  },
  { event: "onboarding_step_viewed", step: "welcome" },
  { event: "onboarding_step_completed", step: "language" },
  { event: "plan_tab_viewed", tab: "monthly" },
  { event: "offer_shown", offering_id: "personal_offer" },
  { event: "offer_redeemed", offering_id: "personal_offer" },
  { event: "account_saved", method: "apple" },
  { event: "store_review_prompted", platform: "ios" },
];

describe("mobile telemetry parsing", () => {
  it.each(validEvents)("accepts the closed $event shape", (event) => {
    expect(parseMobileTelemetryEvent(event)).toEqual(event);
  });

  it("accepts every bounded enum value", () => {
    for (const tab of ["monthly", "yearly", "credit_packs"]) {
      expect(parseMobileTelemetryEvent({ event: "plan_tab_viewed", tab })).not.toBeNull();
    }
    for (const method of ["apple", "google", "email"]) {
      expect(parseMobileTelemetryEvent({ event: "account_saved", method })).not.toBeNull();
    }
    expect(parseMobileTelemetryEvent({ event: "store_review_prompted", platform: "android" })).not.toBeNull();
    expect(parseMobileTelemetryEvent({
      ...validEvents.find((event) => event.event === "mobile_session_completed"),
      backgrounded: false,
      capture_source: "device_playback",
    })).not.toBeNull();
    const platforms: TelemetryPlatform[] = ["android", "ios", "web", "unknown"];
    for (const platform of platforms) {
      expect(parseMobileTelemetryEvent({
        app_version: "1.2.0",
        build_number: "10",
        event: "mobile_app_opened",
        platform,
      })).not.toBeNull();
    }

    const failureStages: MobileFailureStage[] = [
      "audio_capture",
      "device_integrity",
      "identity",
      "microphone_permission",
      "realtime_connection",
      "session_creation",
      "session_runtime",
    ];
    for (const failure_stage of failureStages) {
      expect(parseMobileTelemetryEvent({
        app_session_id: sessionId,
        duration_ms: 1,
        error_code: "known_failure",
        event: "mobile_session_failed",
        failure_stage,
        source_language: "en",
        target_language: "ar",
      })).not.toBeNull();
    }

    const reportCategories = [
      "inaccurate",
      "offensive_harmful",
      "wrong_language",
      "speech_issue",
      "other",
    ];
    for (const error_category of reportCategories) {
      expect(parseMobileTelemetryEvent({
        app_session_id: sessionId,
        error_category,
        event: "mobile_translation_reported",
      })).not.toBeNull();
    }
  });

  it("wraps a valid event and drops unknown request fields", () => {
    expect(parseMobileTelemetryRequest({
      app_install_id: "install_12345678",
      payload: validEvents[7],
      transcript: "must be dropped",
    })).toEqual({
      app_install_id: "install_12345678",
      payload: validEvents[7],
    });
  });

  it.each([
    { event: "onboarding_step_viewed", step: "" },
    { event: "onboarding_step_completed", step: "x".repeat(65) },
    { event: "plan_tab_viewed", tab: "lifetime" },
    { event: "offer_shown", offering_id: "" },
    { event: "offer_redeemed", offering_id: "x".repeat(65) },
    { event: "account_saved", method: "password" },
    { event: "store_review_prompted", platform: "web" },
    { ...validEvents.find((event) => event.event === "mobile_session_completed"), backgrounded: "true" },
    { ...validEvents.find((event) => event.event === "mobile_session_completed"), capture_source: "screen" },
  ])("rejects malformed insight telemetry fields", (event) => {
    expect(parseMobileTelemetryEvent(event)).toBeNull();
  });

  it("rejects an analytics-preference event that turns analytics off", () => {
    expect(parseMobileTelemetryEvent({
      app_version: "1.2.0",
      build_number: "10",
      enabled: false,
      event: "mobile_analytics_preference_changed",
      platform: "ios",
    })).toBeNull();
  });

  it("rejects survey submissions from the relayed analytics protocol", () => {
    expect(parseMobileTelemetryEvent({ event: "rating_submitted", stars: 5, answer: "travel" })).toBeNull();
  });

  it.each([
    null,
    "invalid",
    {},
    { app_install_id: "short", payload: validEvents[0] },
    { app_install_id: "x".repeat(129), payload: validEvents[0] },
    { app_install_id: "install_12345678", payload: null },
  ])("rejects an invalid request envelope", (request) => {
    expect(parseMobileTelemetryRequest(request)).toBeNull();
  });

  it.each([
    null,
    {},
    { event: 42 },
    { event: "unknown_event" },
    { app_version: "", build_number: "10", event: "mobile_app_opened", platform: "ios" },
    {
      app_version: "1.2.0",
      build_number: "x".repeat(65),
      event: "mobile_onboarding_completed",
      platform: "ios",
    },
    { app_version: "1.2.0", build_number: "10", event: "mobile_app_opened", platform: "macos" },
    {
      app_version: "1.2.0",
      build_number: "10",
      enabled: "false",
      event: "mobile_analytics_preference_changed",
      platform: "ios",
    },
    {
      event: "mobile_listen_tapped",
      network_type: "private network name",
      playback_enabled: true,
      source_language: "en",
      target_language: "ar",
    },
    {
      event: "mobile_listen_tapped",
      network_type: "WIFI",
      playback_enabled: "yes",
      source_language: "invalid",
      target_language: "ar",
    },
    {
      app_session_id: "short",
      event: "mobile_session_live",
      source_language: "en",
      startup_latency_ms: 1,
      target_language: "ar",
    },
    {
      app_session_id: sessionId,
      event: "mobile_session_live",
      source_language: "en",
      startup_latency_ms: 86_400_001,
      target_language: "ar",
    },
    {
      app_session_id: "invalid session",
      event: "mobile_first_translation",
      first_translation_latency_ms: 1,
      provider_elapsed_ms: null,
    },
    {
      app_session_id: sessionId,
      event: "mobile_first_translation",
      first_translation_latency_ms: Number.NaN,
      provider_elapsed_ms: null,
    },
    {
      app_session_id: sessionId,
      event: "mobile_first_translation",
      first_translation_latency_ms: 1,
      provider_elapsed_ms: -1,
    },
    {
      app_session_id: sessionId,
      duration_ms: -1,
      error_code: "known_failure",
      event: "mobile_session_failed",
      failure_stage: "session_creation",
      source_language: "en",
      target_language: "ar",
    },
    {
      app_session_id: sessionId,
      duration_ms: 1,
      error_code: "private speech with spaces",
      event: "mobile_session_failed",
      failure_stage: "session_creation",
      source_language: "en",
      target_language: "ar",
    },
    {
      app_session_id: sessionId,
      duration_ms: 1,
      error_code: "known_failure",
      event: "mobile_session_failed",
      failure_stage: "unknown",
      source_language: "en",
      target_language: "ar",
    },
    { ...validEvents[7], app_session_id: "x".repeat(129) },
    { ...validEvents[7], committed_translation: "yes" },
    { ...validEvents[7], error_code: "" },
    { ...validEvents[7], network_type: "x".repeat(65) },
    { ...validEvents[7], outcome: "cancelled" },
    { ...validEvents[7], playback_enabled: 1 },
    { ...validEvents[7], duration_ms: "long" },
    { ...validEvents[7], input_audio_bytes: 1.5 },
    { ...validEvents[7], input_audio_frames: -1 },
    { ...validEvents[7], source_char_count: 1_000_000_001 },
    { ...validEvents[7], translated_char_count: Number.POSITIVE_INFINITY },
    {
      app_session_id: "short",
      error_category: "inaccurate",
      event: "mobile_translation_reported",
    },
    {
      app_session_id: sessionId,
      error_category: "free_form_report",
      event: "mobile_translation_reported",
    },
  ])("rejects a malformed or content-bearing event", (event) => {
    expect(parseMobileTelemetryEvent(event)).toBeNull();
  });
});
