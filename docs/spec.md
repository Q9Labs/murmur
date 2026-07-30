# Murmur Product and Realtime Protocol

## Product

Murmur is an accountless, one-way live translator. A user chooses the spoken and translated languages, taps Listen, and receives:

- a live source transcript;
- a live translated transcript;
- translated speech.

There is one session experience. Listening continues until the user stops, cancels, the configured session limit is reached, or the transport fails.

Murmur does not save microphone audio or transcript history by default. Reports may include transcript snapshots only when a user explicitly opts in.

## Architecture

```text
Native audio capture (24 kHz mono PCM16)
                 |
                 v
Expo app <---- WebSocket ----> Cloudflare Worker <---- WebSocket ----> Realtime provider
                 ^                    |
                 |                    +-- session validation and rate limits
                 |                    +-- provider credentials and adapter
                 |
Translated PCM16 playback + source/translated captions
```

The app-facing transport is provider-neutral. Mobile code must not import provider event names, credentials, models, or session configuration. The Worker owns the provider adapter. A future adapter, such as Gemini Realtime, must preserve the app-facing messages below.

The active adapter uses OpenAI `gpt-realtime-translate` at `/v1/realtime/translations`.

## Session creation

`POST /v1/session` accepts:

```json
{
  "app_install_id": "install identifier",
  "device_integrity": {},
  "source_language": "en",
  "target_language": "ar"
}
```

The source language may be `auto`. The response is:

```json
{
  "app_session_id": "uuid",
  "limits": { "max_session_seconds": 1800 },
  "realtime_ws_url": "wss://worker.example/v1/realtime?...",
  "session_epoch": 1
}
```

The response contains no provider credential or provider WebSocket URL.

## App-facing realtime transport

After opening `realtime_ws_url`, the app sends raw binary 24 kHz mono PCM16 frames. To finish buffered output, it sends:

```json
{ "kind": "close_session" }
```

The Worker sends translated PCM16 as binary messages. JSON messages use this union:

```text
session_opened      { provider_metadata }
source_delta        { delta }
translation_delta   { delta }
session_closed
session_error       { code, retryable }
```

Provider errors are sanitized. Secrets, upstream response bodies, prompts, and raw user content must never appear in error codes or Worker logs. The Worker rejects audio frames larger than 64 KiB.

## OpenAI adapter

The Worker opens an authenticated WebSocket to OpenAI and sends:

- `session.update`, with the target language under `session.audio.output.language`;
- `session.input_audio_buffer.append`, with base64-encoded PCM16;
- `session.close` when the app finishes.

It maps these OpenAI events:

| OpenAI event | App-facing output |
| --- | --- |
| `session.input_transcript.delta` | `source_delta` |
| `session.output_transcript.delta` | `translation_delta` |
| `session.output_audio.delta` | binary PCM16 |
| `session.closed` | `session_closed` |
| `error` | sanitized `session_error` |

The Worker emits `session_opened` only after the upstream WebSocket is connected and configured. Provider metadata is diagnostic only and never controls app behavior.

## Mobile lifecycle

The lifecycle is:

```text
idle
  -> requesting_mic_permission
  -> creating_session
  -> connecting_realtime
  -> live
  -> stopping
  -> ended
```

Failures end in `failed`. Network loss may pass through `network_degraded`. Stop halts capture, requests a provider flush, waits at most five seconds, then tears down. Cancel immediately stops capture and playback, closes transports, clears captions, and closes the Worker session record. Shutdown must be idempotent.

Source and translated deltas update one session transcript span. When the session ends, the translated transcript is committed for display and reporting.

## Audio

- Capture: 24,000 Hz, mono, signed little-endian PCM16.
- Mobile frame target: 20 ms, or 960 bytes.
- Provider audio output: 24,000 Hz mono PCM16.
- Playback must ignore late chunks after cancellation.
- Native and web capture implementations must expose the same sample-rate contract.

## Security and privacy

- `OPENAI_API_KEY` exists only in Worker secrets.
- The Worker uses a stable hashed install identifier as OpenAI's safety identifier.
- Session creation remains rate-limited and may require platform integrity verification.
- Worker logs contain identifiers and operational state, never raw audio or transcripts.
- Session records are closed when the user stops or cancels.
- Production provider retention and training settings must be verified before store submission.

## Verification

Automated coverage must include:

- protocol lifecycle and language validation;
- OpenAI session configuration and event mapping;
- provider error sanitization;
- Worker readiness and removed-route behavior;
- mobile transport parsing, binary audio playback, and close behavior;
- 24 kHz native/web audio contracts;
- unified timeline rendering and auto-scroll;
- stop/cancel idempotency.

Live acceptance requires an OpenAI API key and a real device:

1. create a session through the Worker;
2. speak into the device;
3. observe source and translated transcripts;
4. hear translated speech;
5. stop and confirm the final output is flushed;
6. cancel a second run and confirm audio stops immediately.
