# Murmur Privacy Policy Draft

Last updated: 2026-05-22

Murmur is an accountless one-way live translator. You choose a source language and a target language, tap Listen, speak, and Murmur shows translated captions and plays translated speech.

Before a live translation session starts, Murmur asks for permission to share the data needed for live AI translation with the third-party processors named below. The app does not create a provider session or request microphone audio until this permission is granted.

## Data Murmur Processes

### Microphone Audio

Murmur collects microphone audio from the device microphone only while a live translation session is active. Audio passes through Murmur's Cloudflare Worker to OpenAI for live translation. Murmur does not save microphone audio by default.

### Source Captions

OpenAI returns source-language and translated transcripts through Murmur's Cloudflare Worker. Murmur displays them locally and does not save transcript history by default.

### Translated Captions

OpenAI returns translated speech audio through Murmur's Cloudflare Worker for local playback.

### Anonymous Install And Session Metadata

Murmur has no accounts, login, profile, or cloud transcript history in V1. The app creates an anonymous install identifier stored in platform secure storage. The Worker hashes this identifier and uses it for rate limits, abuse prevention, diagnostics, and provider-token minting. The app includes controls to reset the anonymous identity and delete local Murmur data.

### Translation Reports

You can report an inaccurate, wrong-language, harmful, speech-related, or other translation issue. Reports include session/span metadata and may include text snapshots only when the app explicitly sends them. Report receipts can be used for support follow-up or deletion requests.

### Diagnostics And Latency Telemetry

Murmur may process timing, provider metadata, error codes, language pair, network type, and request/session identifiers to debug reliability and measure latency. Network type means a broad connection category such as Wi-Fi, cellular, offline, unknown, or other; Murmur does not use this to collect network names, nearby network identifiers, or location. Logs should not include raw microphone audio, source captions, translated captions, provider tokens, or generated speech audio by default.

## Third-Party Processors

Murmur's V1 architecture uses these processors. Murmur requires third-party processors that handle user data for Murmur to provide the same or equal protection for that data as described in this policy and required by applicable App Store privacy rules.

- Cloudflare: Worker gateway, rate limits, token brokerage, translation proxy, report endpoint, and privacy-safe logs.
- OpenAI: live transcription, translation, and translated speech generation.

## Retention

Murmur does not retain audio, transcript history, or translated caption history by default. Anonymous session/rate-limit metadata is retained only as needed for abuse prevention, diagnostics, and service operation. Translation reports may be retained for support, safety, and quality review according to the retention period configured for the report triage system.

## Your Choices

- Stop or cancel a live session at any time.
- Use translated captions even when speech output is unavailable.
- Reset Murmur Identity in the app.
- Delete Local Data in the app.
- Contact support to request deletion of server-side diagnostics or report records tied to a report receipt or anonymous install/session metadata.

## Children

Murmur V1 is not designed for children and is not intended for the Kids Category or Designed for Families.

## Contact

Email `q9labs.ai@gmail.com` for privacy, deletion, or support requests. Public privacy URL: `https://murmur.q9labs.ai/privacy`.
