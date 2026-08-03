# Murmur Privacy Policy Draft

Last updated: 2026-07-30

Murmur is an accountless one-way live translator. You choose a source language and a target language, tap Listen, speak, and Murmur shows translated captions. Speech output may play translated phrases when available.

Before a live translation session starts, Murmur asks for permission to share the data needed for live AI translation with the third-party processors named below. The app does not create a provider session or request microphone audio until this permission is granted.

## Data Murmur Processes

### Microphone Audio

Murmur collects microphone audio from the device microphone only while a live translation session is active. Audio is transmitted to Deepgram for speech-to-text. Murmur does not save microphone audio by default.

### Source Captions

Deepgram returns source-language captions from your speech. Murmur sends stable caption spans through Murmur's Cloudflare Worker to OpenRouter and its routed model provider for translation. Murmur does not save transcript history by default.

### Translated Captions

OpenRouter returns translated text. The app displays translated captions locally. If speech output is enabled, stable translated phrases are sent to Cartesia to generate speech audio.

### Anonymous Install And Session Metadata

Murmur has no accounts, login, profile, or cloud transcript history in V1. The app creates an anonymous install identifier stored in platform secure storage. The Worker hashes this identifier and uses it for rate limits, abuse prevention, diagnostics, provider-token minting, and pseudonymous session measurement. The app includes controls to reset the anonymous identity and delete local Murmur data.

### Campaign And Referral Tags

When Murmur is opened directly through a tagged app link, it may process a short allowlisted source, medium, campaign, content, partner, or landing-page label with the next successful live session. These labels are normalized, length-limited, and consumed after that session starts. Store-page links use Apple or Google campaign parameters measured by the respective store; Murmur does not currently copy iOS install attribution into an in-app session. Murmur does not put audio or caption text in campaign attribution.

### Local Engagement State

Murmur stores a qualified-session count and the version and time of its last native rating request on the device. This state is used only to avoid interrupting a live or unsuccessful session and to avoid repeatedly asking for a rating. It contains no audio or caption text.

### Translation Reports

You can report an inaccurate, wrong-language, harmful, speech-related, or other translation issue. Reports include session/span metadata and may include text snapshots only when the app explicitly sends them. Report receipts can be used for support follow-up or deletion requests.

### Diagnostics And Latency Telemetry

Murmur may process timing, provider metadata, error codes, language pair, network type, and request/session identifiers to debug reliability and measure latency. Network type means a broad connection category such as Wi-Fi, cellular, offline, unknown, or other; Murmur does not use this to collect network names, nearby network identifiers, or location. Logs should not include raw microphone audio, source captions, translated captions, provider tokens, or generated speech audio by default.

## Third-Party Processors

Murmur's V1 architecture uses these processors. Murmur requires third-party processors that handle user data for Murmur to provide the same or equal protection for that data as described in this policy and required by applicable App Store privacy rules.

- Cloudflare: Worker gateway, rate limits, token brokerage, translation proxy, report endpoint, and privacy-safe logs.
- Deepgram: streaming speech-to-text.
- OpenRouter and routed model providers: text translation using the configured Gemma model route.
- Cartesia: optional translated speech generation.

## Retention

Murmur does not retain audio, transcript history, or translated caption history by default. Anonymous session, campaign, and rate-limit metadata is retained only as needed for abuse prevention, diagnostics, acquisition measurement, and service operation. Local engagement state remains on the device until it is replaced or the user selects Delete Local Data. Translation reports may be retained for support, safety, and quality review according to the retention period configured for the report triage system.

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
