# Murmur Live Translation Spec

## Product Shape

Murmur is a one-way live translator. The user starts speaking, translated text flows in near real time, and translated speech can follow stable phrase chunks. It is not an events product, not a meeting product, and not a bidirectional conversation mode.

The product should feel immediate: text is the primary realtime surface, speech output is secondary and slightly delayed so it does not speak unstable partial translations.

## Product Invariants

- One active speaker direction per session: source speech in, target text/speech out.
- Text is the core product. Speech output is still important, but it degrades first: when speech generation or playback is failing, captions continue and the UI shows `Speech unavailable`.
- The app must remain foreground-only for V1. No background microphone capture or lock-screen translation unless explicitly designed and re-reviewed.
- No speaker lanes, meeting controls, audience/event controls, or bidirectional conversation UX.
- V1 is accountless. Use anonymous install/session identity for quotas and abuse control, not user accounts or login.

## Canonical Language

Use these terms consistently in code, docs, UI specs, analytics, and review notes:

| Term | Meaning | Avoid |
| --- | --- | --- |
| `session` | One continuous live translation run from start to stop/cancel. | meeting, event, room |
| `source language` | Language the user is speaking. | input language when user-facing |
| `target language` | Language Murmur translates into. | output language when user-facing |
| `source captions` | Live transcript text in the source language. | original transcript, transcription blob |
| `translated captions` | Live translated text shown in the target language. | response, completion |
| `span` | The core phrase/clause unit Murmur tracks, translates, and may speak. | message, paragraph, utterance when not final |
| `tentative span` | Interim speech text not stable enough to translate or speak. | draft message |
| `stable span` | Phrase/clause judged stable enough for translation. | final transcript if Deepgram has not finalized |
| `committed span` | A translated stable span accepted for display and optional speech. | completed message |
| `revision` | A version of a span after correction or stabilization. | retry number |
| `speech output` | Target-language audio generated from committed translated text. | voice reply, TTS response |
| `speech unavailable` | User-visible degraded state when text works but generated speech cannot play. | failed, broken, error-only wording |
| `echo loop` | Cartesia output being captured by the microphone and re-transcribed. | feedback when the meaning is audio routing |
| `Worker` | Murmur's Cloudflare Worker control/translation gateway. | server, backend, edge server unless generic |
| `provider token` | Short-lived credential minted by the Worker for Deepgram or Cartesia. | API key |
| `provider secret` | Durable secret held only by the Worker. | client key |
| `report translation` | In-app action for bad/offensive/inaccurate AI output. | flag AI, report content |

Canonical code-ish names:

```txt
app_session_id
session_id
session_epoch
connection_id
token_bundle_id
span_id
revision
event_seq
source_language
target_language
source_caption
translated_caption
speech_status
speech_unavailable_reason
translation_request_id
speech_request_id
translation_attempt
speech_attempt
provider_metadata
```

## Operator Environment

Implementation and release work requires access to the relevant Cloudflare, Expo, Apple, Google Play, and GitHub projects. Verify the active account before running any command that changes hosted or store state. Keep credentials in platform secret stores or local ignored files, never in the repository or issue discussions.

## Canonical Flow

1. User opens Murmur and chooses source language plus target language.
2. User taps the microphone.
3. The app streams microphone audio as realtime PCM frames.
4. Deepgram Nova-3 streams interim/final transcript events back to the app.
5. The app stabilizes transcript spans locally and sends only stable spans to Murmur's Worker translation endpoint.
6. The Worker calls OpenRouter `google/gemma-4-26b-a4b-it` and streams translated chunks back to the app.
7. The app renders translated text immediately.
8. Once a translated phrase is stable, the app sends it directly to Cartesia Sonic 3.5 for speech generation.
9. Cartesia streams audio back to the app for playback.
10. User can stop or cancel at any time; the session tears down microphone capture, Deepgram, Worker translation, Cartesia, and playback gracefully.

## Non-Goals

- No bidirectional conversation UX in the first rebuild.
- No event/stage/audience translation product.
- No durable provider API keys in the mobile app.
- No file-chunk recording loop for pseudo-streaming audio.
- No translation of the entire accumulated transcript on every update.
- No fake demo mode that hides broken provider integration.
- No user accounts in V1 unless Hasan explicitly changes the account strategy.
- No history/saved transcripts in V1 unless privacy, deletion, and store disclosures are redesigned first.

## Provider Stack

### Speech-to-Text

Primary: Deepgram Nova-3 streaming.

Use the Murmur Worker Deepgram WebSocket proxy for V1. The app still streams realtime PCM frames, but the Deepgram API key stays server-side because the provided Deepgram key could not mint temporary `/auth/grant` tokens. Configure fixed source language whenever possible. Do not rely on generic streaming language detection for production Arabic behavior; Arabic should use explicit language/dialect settings after a source-language choice.

Initial Deepgram settings to test:

```txt
model=nova-3
encoding=linear16
sample_rate=16000
channels=1
interim_results=true
punctuate=true
smart_format=true
vad_events=true
endpointing=300
utterance_end_ms=1000
```

Deepgram endpointing/VAD is enough for launch correctness. Client-side VAD is optional later for cost, battery, and UX, but must include pre-roll and hangover buffers to avoid clipping speech. During silence, the app must send provider-required keepalive messages rather than closing and reopening streams.

Endpointing values to benchmark before locking launch defaults: `250`, `300`, `400`, and `700` ms. Test English, Arabic, Dutch, noisy speech, long pauses, and code-switching.

### Text Translation

Primary: OpenRouter `google/gemma-4-26b-a4b-it`.

The app does not call OpenRouter directly. The Cloudflare Worker owns the OpenRouter API key, prompt template, model pinning, request caps, language validation, rate limits, timeout behavior, latency logging, and spend tracking.

Translation requests should be streaming. Default transport should be an app-to-Worker WebSocket unless a real-device spike proves React Native streaming fetch is reliable enough. The Worker still calls OpenRouter via server-side HTTP streaming.

If the custom OpenRouter SSE parser becomes brittle, the preferred fallback is to move Worker-side OpenRouter streaming to the Vercel AI SDK with the OpenRouter community adapter instead of expanding bespoke parser complexity. Keep the app-to-Worker protocol stable while swapping the upstream streaming implementation.

Prompt shape:

```txt
You are a professional {source_lang} ({src_lang_code}) to {target_lang} ({tgt_lang_code}) translator.
Accurately preserve meaning, tone, names, numbers, and cultural nuance.
Produce only the {target_lang} translation. Do not add explanations.

Text:
{stable_span_text}
```

Use low temperature, short max-token caps, and no reasoning/thinking options. Benchmark provider-specific TTFB; Hasan observed on 2026-05-16 that OpenRouter Gemini 3.1 Flash-Lite TTFB is consistently higher than OpenRouter Gemma 4 26B for this use case.

The Worker must not rely on OpenRouter's default provider routing. Configure and benchmark provider routing explicitly for latency and privacy, including provider allowlists/order, `sort: "latency"` where useful, and zero-data-retention or data-collection-deny options where supported.

OpenRouter routing must use an allowlist of providers with documented retention/training posture before store submission. Request options should be pinned in code and tests, including provider ordering/allowlist, fallback behavior, required parameters, and data-collection-deny or ZDR settings where available. The privacy policy must disclose that OpenRouter and routed model providers may process stable transcript spans.

Current Worker defaults pin a provider routing contract instead of relying on raw OpenRouter defaults: ordered providers `deepinfra/fp8`, `cloudflare`, and `google-vertex/global`, `data_collection: "deny"`, `require_parameters: true`, `allow_fallbacks: true`, and `sort: "latency"`. Production release still requires account-level provider retention verification and may tighten to `OPENROUTER_PROVIDER_ONLY` and/or `OPENROUTER_PROVIDER_ZDR=true` after smoke tests.

TranslateGemma remains a candidate only after a fast hosted inference path is confirmed. It is not currently the OpenRouter fast path.

### Speech Generation

Primary: Cartesia Sonic 3.5.

Use direct app-to-Cartesia WebSocket connections with Worker-minted short-lived Cartesia access tokens. Send only stable translated phrase chunks, not every provisional token. Text should lead speech.

TTS playback must be implemented as a streaming audio sink with a jitter buffer, cancellation, underrun metrics, and echo-loop tests. Do not write every TTS chunk to temporary files for playback.

Fallback candidate: ElevenLabs Flash v2.5.

Deepgram Aura is not the primary TTS path because current public language coverage is too narrow for Murmur's intended launch language set.

## Language Requirements

Arabic is required. The launch language plan should include at least:

- Arabic
- Spanish
- French
- German
- Italian
- Portuguese
- Japanese
- Chinese
- Korean
- Russian
- Hindi
- Dutch

Store languages with BCP-47 codes, display names, native names, RTL metadata, and provider-specific mappings. Arabic UI and text rendering must support RTL correctly.

Before provider integration, create a language registry with these fields:

```txt
app_code
display_name
native_name
rtl
script
deepgram_language
openrouter_source_name
openrouter_target_name
cartesia_language
cartesia_voice_id
fallback_tts_voice_id
smoke_test_source_phrase
expected_translation_notes
dialect_or_variant_notes
```

Specific launch decisions still needed:

- Arabic: choose default source mode for Modern Standard Arabic vs dialects; verify Arabic source and Arabic target with real speech.
- Chinese: choose simplified/traditional target handling and display labels.
- Portuguese: choose Portugal vs Brazil defaults.
- Spanish/French/Arabic: decide whether dialect selection is visible in V1 or only encoded in advanced settings.

## Architecture

```txt
Mobile app
  |-- WebSocket PCM --> Cloudflare Worker --> Deepgram Nova-3
  |-- WebSocket --> Cloudflare Worker --> OpenRouter Gemma 4 26B
  |-- direct WebSocket --> Cartesia Sonic 3.5
```

The Worker is required for OpenRouter, Deepgram secret isolation, rate limits, and token brokerage. It relays raw microphone PCM only to Deepgram for the active live session and must not log, buffer durably, or persist audio content.

Worker responsibilities:

- Authenticate anonymous install/session integrity.
- Proxy Deepgram streaming STT without exposing the Deepgram API key to the app.
- Mint Cartesia short-lived access tokens.
- Proxy/stream OpenRouter translation responses.
- Validate source/target language combinations.
- Enforce per-user/session request limits.
- Cap OpenRouter tokens and spend.
- Log latency measurements without storing default transcript/audio content.
- Apply Apple App Attest / Play Integrity or an equivalent abuse-control gate before public release.

Initial rate-limit dimensions:

- Per install/session: max active sessions, max session duration, max sessions per hour/day.
- STT/TTS token brokerage: short TTLs, one active token bundle per active session unless reconnecting.
- Translation: max characters per span, max spans per minute, max output tokens per span, max concurrent translation requests.
- Spend: daily budget caps, per-install anomaly detection, provider timeout/cancellation limits.
- Abuse: block session creation when integrity checks fail or usage exceeds thresholds.

Initial V1 defaults to validate in beta:

| Limit | Default |
| --- | ---: |
| Active sessions per install | 1 |
| Max session duration | 15 minutes |
| Sessions per install per hour | 6 |
| Sessions per install per day | 30 |
| Provider token TTL | 2-5 minutes |
| Max characters per span | 600 |
| Max translated spans per minute | 30 |
| Concurrent translations per session | 2 |
| Max output tokens per span | 300 |
| Max session recovery window | 20 seconds |

Review/test builds may use a separate quota bucket, but bypasses must be explicit, temporary, and unavailable in production builds.

Do not provision Cloudflare Containers for V1. Consider Durable Objects only if a full server-side session coordinator becomes necessary.

## Accountless Identity Contract

V1 has no accounts, login, profiles, synced history, or cloud transcript storage.

The anonymous install identity is only for abuse prevention, quota enforcement, integrity checks, and diagnostics. It must not be presented as an account, unlock durable user-owned cloud content, or store transcript history. Treat it as fraud/session metadata, not a user profile.

Requirements:

- Store anonymous install identity in platform secure storage.
- Hash or otherwise pseudonymize install identity before server-side storage.
- Provide `Reset Murmur Identity` and `Delete Local Data` actions.
- If any server-side diagnostic/report data can be tied to an install id or report receipt, provide a support deletion path and disclose retention.
- Do not add saved history, sync, sign-in, profiles, or subscriptions without re-opening account deletion and store policy requirements.

## Integrity And Token Minting

Public builds must pass Apple App Attest on iOS or Play Integrity on Android before provider tokens are minted, except for a documented unsupported-device fallback with stricter quotas.

Flow:

1. App requests a server nonce.
2. App submits an App Attest / Play Integrity assertion with anonymous install metadata.
3. Worker validates assertion server-side and risk-scores the session.
4. Worker mints a token bundle only if risk, quota, and language validation pass.

Token bundle rules:

- Each `token_bundle_id` is bound to `app_session_id`, hashed install identity, source/target languages, TTL, quota bucket, and session epoch.
- Default token TTL is 2-5 minutes.
- One active token bundle per active session, except during controlled reconnect/refresh.
- Refresh before expiry; refresh preserves `app_session_id` and increments connection/session epoch as needed.
- Stop/cancel marks the session closed and prevents further translation. Provider tokens are revoked where supported and blocklisted locally by token id/session id where direct revocation is unavailable.
- Never log provider token bodies in app logs, crash reports, Worker logs, analytics, or report payloads.

Debug/dev bypasses must be local-build only and impossible to activate in production binaries.

## Native Realtime Audio Contract

Realtime audio is the highest-risk implementation area. V1 must prove this on real iOS and Android devices before STT/TTS product work continues:

- Microphone frames: signed 16-bit little-endian PCM, mono, 16 kHz, preferred 20 ms frames: 320 samples / 640 bytes per frame.
- Frame cadence: 20-60 ms allowed during experiments; choose one launch cadence after benchmarks.
- Timestamps: monotonic native capture timestamps on every frame; track drift, dropped samples, inserted samples, and native-to-JS delay.
- Resampling: V1 should resample natively to 16 kHz mono PCM16 for Deepgram. Do not change provider-native format until a benchmark proves it is better.
- Downmixing: clipping-safe downmix from multi-channel input.
- Transport: frames must cross the React Native/native boundary without accumulating unbounded queues.
- Backpressure: mic ring buffer max 250 ms; never send delayed microphone audio as if it is live. If outbound audio queue exceeds the cap for more than 1 second, stop STT with `network_backpressure`.
- Audio session/routing: handle wired headphones, Bluetooth, speaker, interruptions, route changes, silent mode, and low-power mode.
- Platform audio policy to test:
  - iOS: `PlayAndRecord` category/mode/options, AEC behavior, speaker vs receiver vs Bluetooth routing.
  - Android: `AudioRecord` + `AudioTrack`, `AudioManager` mode/focus, hardware AEC/NS/AGC behavior, speaker and Bluetooth routing.
- Echo policy: prevent Murmur from transcribing its own Cartesia output. Prefer headphones when available. If output route is speaker and AEC is not verified for the active session, either disable speech output or gate/drop mic frames while speech output is audible, with pre/post-roll.
- Playback: streamed TTS audio needs a low-latency jitter buffer, cancellation, underrun/overrun metrics, and a way to hard-stop superseded speech locally.
- Cartesia cancellation caveat: provider cancellation may not stop audio that has already begun generating. The app must hard-stop local playback and ignore late chunks by `speech_request_id` / context id.
- Background behavior: V1 is foreground-only. Stop microphone and TTS sessions when the app backgrounds unless a future spec explicitly adds background mode.

Implementation may require a custom Expo native module or a vetted native audio dependency. Do not assume `expo-audio` alone can provide production-grade microphone PCM frames and streaming playback until a spike proves it.

## Session Lifecycle State Machine

The session state machine must be explicit and reducer-driven. Double-start, partial-start failure, reconnect, backgrounding, stop, and cancel should be impossible to represent ambiguously.

Canonical states:

```txt
idle
requesting_mic_permission
creating_session
connecting_deepgram
connecting_translate_ws
live
network_degraded
transport_disconnected
recovering
stopping
cancelling
failed
ended
```

Identity fields:

```txt
app_session_id       stable user-visible session run id
session_epoch        increments on reconnect/recovery/teardown boundary
token_bundle_id      renewable provider-token bundle id
connection_id        provider transport connection id
audio_generation_id  native audio generation guard
event_seq            monotonic sequence per transport where available
```

Rules:

- Only one active session can exist per app process.
- Starting a session from any non-idle/non-ended state is ignored or returns a typed error.
- Token refresh preserves `app_session_id`; reconnect increments `session_epoch` or `connection_id` and preserves visible spans.
- All app/provider/Worker events must carry enough identity to reject stale events: `app_session_id`, `session_epoch`, `connection_id` where relevant, request id, `span_id`, `revision`, and optional `event_seq`.
- Reducers must drop events that do not match the current active identity/state.
- Foreground return after background teardown must not auto-restart the microphone. Preserve visible captions locally and require explicit user start.
- Network loss is recoverable only within the max recovery window. During recovery, do not buffer unlimited mic audio; drop stale mic frames rather than replaying delayed speech.
- `offline_timeout` transitions to `failed`/`ended` with visible captions preserved.

## Span Stabilization Contract

The core product unit is a stable span: a phrase or clause that is stable enough to translate without waiting for the whole utterance.

Each span must include:

```txt
span_id
revision
status
source_text
translated_text
source_time_range
target_language
translation_request_id
speech_request_id
provider_metadata
created_at_ms
updated_at_ms
supersedes_span_ids
translation_attempt
speech_attempt
```

Rules:

- Interim text may render visually, but only stable spans can be sent to translation and TTS.
- Stable spans should be phrase/clause sized, not full-session transcript sized.
- Final Deepgram corrections may revise the affected span, but must not cause the whole transcript to jump.
- Never send the entire accumulated transcript for retranslation.
- Include the previous 10 stable spans as translation context, clearly separated from the text being translated. Context spans must never be retranslated as part of the current span.
- Abort stale translation requests when a span revision supersedes them.
- Never speak a superseded span revision.
- TTS may start only after a span is translated and no longer likely to be revised.
- Cancellation must mark in-flight spans as cancelled and prevent late provider deltas/audio from mutating visible state.
- Increment `revision` only when source text or source time range changes. Use `translation_attempt` / `speech_attempt` for identical-input retries.
- Spans must remain ordered and non-overlapping. If Deepgram corrections split/merge boundaries, create new revisions plus `supersedes_span_ids` and tombstone old span ids.
- Deltas write to a revision-local draft buffer. Committed translated captions update atomically on `translation_done` only if the request is still current.
- Define launch-stable as either provider-final/speech-final or unchanged for a benchmarked stability window; do not leave "no longer likely to be revised" as intuition.

Suggested statuses:

```txt
hearing -> tentative_span -> stable_span -> translating -> translated -> speaking -> complete
                                         \-> speech_unavailable
                                         \-> cancelled
```

## Worker Translation Protocol

The Worker is the only component allowed to call OpenRouter.

V1 should expose:

```txt
POST /v1/session
WS   /v1/translate
POST /v1/report
POST /v1/session/{app_session_id}/stop
```

`POST /v1/session` returns short-lived provider credentials and session settings:

```json
{
  "app_session_id": "uuid",
  "expires_at": "iso8601",
  "token_bundle_id": "uuid",
  "deepgram_token": "short-lived",
  "cartesia_token": "short-lived",
  "translation_ws_url": "wss://...",
  "limits": {
    "max_session_seconds": 900,
    "max_translation_chars_per_minute": 6000
  }
}
```

`WS /v1/translate` accepts stable span translation requests:

```json
{
  "type": "translate_span",
  "app_session_id": "uuid",
  "session_epoch": 1,
  "connection_id": "uuid",
  "span_id": "uuid",
  "revision": 3,
  "translation_attempt": 1,
  "source_language": "en-US",
  "target_language": "ar",
  "text": "Where is the train station?",
  "context": [
    { "source_text": "Excuse me.", "translated_text": "..." }
  ],
  "client_sent_at_ms": 123456
}
```

The Worker streams:

```json
{ "type": "translation_started", "app_session_id": "uuid", "session_epoch": 1, "span_id": "uuid", "revision": 3, "translation_request_id": "uuid" }
{ "type": "translation_delta", "app_session_id": "uuid", "session_epoch": 1, "span_id": "uuid", "revision": 3, "translation_request_id": "uuid", "text": "..." }
{ "type": "translation_done", "app_session_id": "uuid", "session_epoch": 1, "span_id": "uuid", "revision": 3, "translation_request_id": "uuid", "text": "...", "provider": { "model": "google/gemma-4-26b-a4b-it" } }
{ "type": "translation_error", "app_session_id": "uuid", "session_epoch": 1, "span_id": "uuid", "revision": 3, "translation_request_id": "uuid", "code": "provider_timeout" }
```

Cancellation/supersession messages:

```json
{ "type": "cancel_translation", "app_session_id": "uuid", "span_id": "uuid", "revision": 3, "translation_request_id": "uuid", "reason": "user_cancelled" }
{ "type": "supersede_span", "app_session_id": "uuid", "old_span_id": "uuid", "new_span_id": "uuid", "old_revision": 3, "new_revision": 4, "reason": "deepgram_correction" }
{ "type": "stop_session", "app_session_id": "uuid", "session_epoch": 1, "reason": "user_stopped" }
{ "type": "cancel_session", "app_session_id": "uuid", "session_epoch": 1, "reason": "user_cancelled" }
```

Worker requirements:

- Validate source/target languages against the registry.
- Enforce max text length, max output tokens, per-session quotas, and spend caps.
- Abort upstream OpenRouter requests when the client disconnects or a superseding revision arrives.
- Forward streamed deltas without buffering the whole response.
- Parse provider SSE safely, including pre-stream HTTP errors, mid-stream SSE errors, comments, partial JSON lines, `[DONE]`, empty deltas, provider ids, and done markers.
- Record OpenRouter generation/provider ids where available.
- Log timing/metadata by default, not transcript content.
- Apply App Attest / Play Integrity or an equivalent abuse-control gate before public release.
- Use `AbortController` or platform equivalent for upstream OpenRouter cancellation, while assuming some providers may still bill for cancelled generations.
- When stop/cancel is received, mark the server session closed and reject further translation for that `app_session_id`.

Graceful teardown requirements:

- `stop_session` is user-intended normal completion. Freeze new mic input, optionally send Deepgram finalize, wait up to a short bounded window for current final STT / active translation, commit only still-current work, then cancel the rest, stop playback, close transports, and release native audio resources.
- `cancel_session` is immediate teardown. Increment `session_epoch` / `audio_generation_id`, stop mic capture on the audio thread, close sockets, abort Worker/OpenRouter requests, hard-stop Cartesia playback, flush queues, ignore late events, and leave the user at a clean idle state.
- App background, route interruption, permission revocation, and network loss must call the same teardown path with a machine-readable reason.
- Teardown must be idempotent. Calling it twice should not throw, leak sockets, or resurrect audio.

## Speech Playback Coordinator

Only one speech output may be audible at a time.

Speech states:

```txt
queued -> generating -> buffering -> playing -> complete
                                      \-> cancelled
                                      \-> speech_unavailable
```

Rules:

- Every speech request has `speech_request_id`, `span_id`, `revision`, `speech_attempt`, and provider context id.
- Drop audio chunks whose `speech_request_id` or context id is no longer active.
- Speech output for later spans must not overlap earlier audible output unless a future spec explicitly adds mixing.
- If speech generation is late, failed, cancelled, or unsafe because of echo risk, keep translated captions and show `Speech unavailable`.
- TTS jitter buffer must define min/max buffered audio, underrun handling, overrun handling, and `max_buffer_delay_ms`.
- Local playback clock owns audible timing; provider chunk timing is advisory.

## Latency Budget

Target p50 first translated text: 0.7-1.4 seconds after speech reaches the microphone.

Target p50 translated speech first audio: 1.1-2.1 seconds after speech reaches the microphone.

Approximate p50 budget before real instrumentation:

| Step | Target |
| --- | ---: |
| Mic frame capture/buffer | 20-60 ms |
| App to Deepgram | 40-120 ms |
| Deepgram interim transcript | 250-450 ms total |
| Local span stabilization | 50-150 ms |
| App to Worker | 30-100 ms |
| Worker to OpenRouter Gemma TTFB | benchmark, budget 250-600 ms |
| Translation stream completion for short phrase | 80-250 ms after TTFB |
| UI render | 16-50 ms |
| Cartesia first audio after stable translated phrase | about 250-450 ms including network/playback buffer |

Every implementation phase must instrument p50/p90/p95:

- mic capture timestamp
- first audio frame sent
- first Deepgram interim received
- Deepgram final/speech_final/utterance_end received
- stable span emitted
- Worker translation request received
- OpenRouter request sent
- OpenRouter first token received
- first translated token returned to app
- stable phrase sent to Cartesia
- first audio byte received
- playback start
- native bridge queue duration
- mic ring buffer depth
- outbound audio queue depth
- TTS jitter buffer delay
- provider generation/context ids

After implementation, calculate and report p50, p90, and p95 latency for every instrumented step before TestFlight. Report by language pair, device class, network type, and provider route. p99 is useful for internal debugging, but p50/p90/p95 are the launch gate.

## Client Behavior

The app should model transcript and translation as spans, not one mutable text blob. Interim text may update visually, but only stable spans should be translated and spoken. Final Deepgram corrections should update the relevant span without causing the whole transcript to jump.

## Failure Behavior

- If TTS fails or is slow, continue text translation and mark speech as unavailable for that span.
- If translation fails, keep source captions visible and show a concise retryable error.
- If STT fails, stop or recover the active session based on the session state machine and explain that live listening disconnected if recovery fails.
- If provider tokens are near expiry, refresh the token bundle while preserving `app_session_id`; do not create a quota-resetting new user-visible session.
- If the network is poor, prefer stable text over speech and reduce/disable TTS automatically.
- If echo-loop risk is detected, pause TTS or require headphones.
- Retried spans must preserve `span_id` and increment revision or attempt metadata, not create duplicate visible content.
- User cancellation must stop listening and playback immediately, then ignore late provider events.
- If network degradation causes queue growth, drop stale mic frames instead of replaying delayed audio.

## Data Inventory

Prepare App Privacy and Play Data Safety from this inventory before any external testing:

| Data | Source | Processor | Murmur Retention | Processor Retention | Store Disclosure Notes |
| --- | --- | --- | --- | --- | --- |
| Microphone audio frames | User speech | Deepgram, optionally local audio module | Not retained by Murmur by default | Must be verified with provider settings/contracts | Sensitive user data; disclose third-party processing |
| Transcript text | Deepgram STT | Murmur app, Worker for stable spans, OpenRouter | Not retained by Murmur by default | Must be verified with provider settings/contracts | User content / AI input |
| Translated text | OpenRouter/Gemma | Worker, app, Cartesia for spoken output | Not retained by Murmur by default unless included in a user report | Must be verified with provider settings/contracts | AI-generated output; include report path |
| Generated speech audio | Cartesia | App playback | Not retained by Murmur by default | Must be verified with provider settings/contracts | Derived from translated text |
| Language pair/settings | User selection | Murmur app, Worker | Retained only if settings persistence is implemented | N/A unless synced | App functionality |
| Latency telemetry | App/Worker events | Murmur | Retain aggregated metrics only | N/A | Diagnostics; avoid content |
| Session/device integrity signals | App/Worker | Murmur, Apple/Google if enabled | Short-lived / abuse prevention | Apple/Google per their systems | Fraud prevention/security |
| Crash/diagnostics | App | TBD | TBD | TBD | Must match actual SDK choices |
| Translation reports | User report action | Murmur, possibly support/moderation tooling | Defined report retention period | N/A unless tooling uses processors | AI reporting/safety |

No transcript/audio retention is a product requirement unless Hasan explicitly approves a feature that needs history. If history is added, privacy, deletion, export, and store disclosures must be updated first.

Before store submission, verify and document provider retention/training settings for Deepgram, OpenRouter routed providers, Cartesia, Cloudflare logs, crash/diagnostics tooling, and support/report tooling.

## Privacy And Security

- No Deepgram, OpenRouter, or Cartesia durable API keys in the app.
- Use iOS Keychain / Android Keystore / Expo SecureStore only for user/session credentials, not shared provider secrets.
- Audio and transcript content should not be retained by default.
- Logs must not include raw source captions, translated captions, microphone audio, provider tokens, or generated speech. Prefer timings, provider ids, language codes, byte counts, token counts, and error codes.
- The app must clearly disclose microphone streaming to third-party processors before App Store submission.
- V1 is accountless. Do not add sign-up, sign-in, saved cloud history, or user profiles without updating this spec and adding account deletion requirements.
- Accountless does not remove deletion/privacy obligations: provide `Delete Local Data`, `Reset Murmur Identity`, and a support path for server-side diagnostics/report deletion where applicable.
- Add an in-app "Report translation" path before Google Play submission so users can flag offensive, harmful, or materially incorrect AI-generated output without leaving the app.
- Publish live privacy policy, terms, support URL, and deletion/support contact before TestFlight external testing or Play closed testing.
- Request microphone permission only at the moment the user starts live translation. If denied, leave non-microphone screens/settings usable.
- Show a visible active-microphone state and an always-available stop/cancel control while listening.

## Report Translation Workflow

Every committed translated span must expose `Report translation`.

Report schema:

```txt
report_id
app_session_id
span_id
revision
source_language
target_language
provider_metadata
error_category
optional_user_note
optional_source_text_snapshot
optional_translated_text_snapshot
created_at_ms
```

Rules:

- Reports do not require an account.
- Report categories should include inaccurate translation, offensive/harmful output, wrong language, speech issue, and other.
- Text snapshots are optional and require clear disclosure because they retain user content.
- Reports have an abuse limit, retention period, operational triage path, and privacy policy disclosure.
- Store reviewer instructions must include how to submit a report.

## Store Submission Readiness

Murmur is not store-ready until these are complete:

- App completeness: real live translation flow works on production/review backend.
- Privacy policy: lists Deepgram, OpenRouter/providers, Cartesia, Cloudflare, data categories, retention, deletion, and support contact.
- In-app disclosure: before first microphone session, clearly explains that speech audio/transcripts are processed by third-party services to provide translation and speech output.
- App Privacy / Data Safety: filled from the data inventory and actual SDK list.
- AI reporting: users can report bad/offensive/inaccurate translations in app; reports should include optional user note and minimal span metadata.
- Account deletion: either no accounts in V1, or in-app deletion plus Google Play web deletion URL and retention summary.
- Accountless disclosure: if V1 remains accountless, store notes/privacy copy should explicitly state there is no account creation and therefore no account deletion flow.
- Review access: reviewer instructions, backend availability, demo/test account if accounts exist, and exact flow to test translation/TTS.
- Permission audit: only declare permissions that are used by the submitted build.
- Native manifest audit: no background audio, foreground service, location, Bluetooth, notifications, or extra audio permissions unless implemented, justified, and store-reviewed.
- Content rating: account for user-spoken profanity/sensitive content that may be transcribed or translated.
- Kids: V1 is not for the Kids Category / Designed for Families unless Hasan explicitly designs a child-safe version.
- Monetization: V1 is free with no subscriptions, no external payment links, and no paid digital features unless a billing section is added for Apple IAP / Google Play Billing.
- Store assets: app icon, adaptive icon, screenshots, feature graphic, support URL, marketing URL if used, and release notes that match the submitted build.
- iPad/tablet: either test and provide tablet screenshots or turn off tablet support before App Store submission.
- Revisit `ITSAppUsesNonExemptEncryption` after App Attest, native crypto, and provider SDK choices.

Store packet must include privacy policy URL, support URL, terms URL, reviewer notes, backend availability window, exact test flow, no-account explanation, report-translation instructions, permission explanations, Data Safety/App Privacy answers, content rating answers, known limitations, and monetization disclosure.

Draft review note:

```txt
Murmur is a one-way live translator. When the user starts a session, Murmur streams microphone audio to Deepgram for speech recognition, sends stable transcript spans through Murmur's Cloudflare Worker to OpenRouter for translation with Gemma 4 26B, and sends stable translated phrases to Cartesia for optional speech output. The app does not retain audio or transcript content by default.
```

## Rebuild Phases

1. Reset repo to a clean Expo shell plus this spec.
2. Prove native realtime audio capture/playback on real iOS and Android devices.
3. Build Cloudflare Worker token broker and OpenRouter streaming translation endpoint.
4. Create provider language registry and smoke fixtures.
5. Integrate Deepgram Nova-3 and transcript span stabilizer.
6. Integrate OpenRouter Gemma translation through Worker.
7. Integrate Cartesia Sonic speech output for stable phrase chunks.
8. Add graceful teardown, failure behavior, privacy copy, AI report flow, and store-readiness packet.
9. Instrument latency and run real-device benchmarks.
10. Add regression tests around span stabilization, language mapping, Worker request validation, streaming parsers, privacy-safe logs, and audio loopback.
11. Polish App Store-ready UX.

## Verification Gates

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- Unit tests once rebuild modules exist
- Real-device iOS microphone streaming test
- Real-device Android microphone streaming test
- Real-device TTS streaming playback test
- Echo-loop test with speaker output and headphones
- Arabic source and Arabic target smoke tests
- Dutch smoke test
- Low-network and provider-timeout failure tests
- Stop/cancel teardown test with late Deepgram/OpenRouter/Cartesia events
- Session state-machine tests: double start, partial start failure, token refresh, token expiry mid-session, translate WS reconnect, Deepgram reconnect failure, Cartesia reconnect failure, background-to-foreground, stale epoch events.
- Native lifecycle tests: 15-minute soak, rapid start/stop 20x, route change mid-utterance, Bluetooth connect/disconnect, network stall, permission revocation.
- Backpressure tests: mic ring buffer overflow, outbound WS queue overflow, TTS jitter underrun/overrun.
- RTL tests: Arabic mixed with numbers, Latin names, punctuation, wrapping, text selection/copy, and mirrored layout where appropriate.
- p50/p90/p95 latency report generated from real implementation telemetry before TestFlight
- Store-readiness packet checked with the mobile-store-submission-readiness workflow
