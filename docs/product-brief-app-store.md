<!-- cspell:words Wordly Interprefy -->

# Murmur app-store product brief

Scope: factual research from the current repository state on 2026-08-01. This is a product brief for a copywriter, not proposed store copy. The worktree contains uncommitted product and store-metadata changes, so public-store status should be checked separately before publication.

## 1. App name, IDs, platforms, and tech stack

- **Name:** Murmur. The app config and store title use `Murmur`; the current version is `1.2.0`. Sources: `apps/mobile/app.json`, `apps/mobile/fastlane/metadata/en-US/name.txt`, `package.json`.
- **iOS:** bundle ID `com.q9labsai.murmur`; App Store app ID `6756962206`. iPad support is explicitly disabled. Source: `apps/mobile/app.json`.
- **Android:** package ID `com.q9labsai.murmur`; Google Play URL is present; current Android version code is `3`. Sources: `apps/mobile/app.json`, `apps/mobile/eas.json`.
- **Platforms it actually targets:** iOS and Android have store build profiles, submission metadata, store URLs, and platform-specific permissions/assets. Expo web support and a browser audio module exist in code, but no web store target or web product listing was found. Sources: `apps/mobile/eas.json`, `apps/mobile/fastlane/`, `apps/mobile/modules/murmur-audio/src/MurmurAudioModule.web.ts`.
- **Mobile stack:** Expo `~54.0.35`, React Native `0.81.5`, React `19.1.0`, Expo Router, TypeScript, and pnpm. Source: `apps/mobile/package.json`, `package.json`.
- **Realtime/backend stack:** a Cloudflare Worker with a Durable Object rate/session store and WebSocket endpoints. The Worker keeps the OpenAI API key off the device, creates hashed-install sessions, proxies OpenAI Realtime audio and captions, and accepts translation reports. Sources: `README.md`, `apps/worker/src/index.ts`, `apps/worker/src/routes/session.ts`, `apps/worker/src/sockets/realtime.ts`, `apps/worker/src/rateLimitDurableObject.ts`.
- **AI/audio service:** OpenAI Realtime handles live speech recognition, translation, and optional translated speech through the Worker. Sources: `apps/worker/src/providers/openaiRealtime.ts`, `apps/worker/src/sockets/realtime.ts`, `apps/worker/wrangler.toml`.
- **Native audio:** a custom Expo module with Swift for iOS, Kotlin/Android for Android, and a Web Audio implementation for web. It captures mono PCM16 at 16 kHz and can stream PCM speech playback. Sources: `apps/mobile/modules/murmur-audio/`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`.

## 2. What the app does, the problem, and the target user

Murmur is a one-way live speech translator. The user chooses a source language and target language, taps **Listen**, speaks or listens to one speaker, and receives source/translated captions as speech is recognized and translated. Stable translated phrases can also be played as target-language speech when OpenAI Realtime audio output is available. Sources: `README.md`, `docs/spec.md`, `apps/mobile/src/home/onboarding.tsx`, `apps/mobile/src/home/translationSurface.tsx`.

The core problem is following ongoing spoken content in another language without waiting for an organizer-managed interpretation setup. The repository positions the product around tours, talks, lectures, classes, demonstrations, sermons, workshops, and conferences, with the individual attendee or traveler as the user. Sources: `apps/mobile/fastlane/metadata/en-US/description.txt`, `docs/growth-and-aso-strategy.md`.

The product is deliberately one-directional. The spec excludes bidirectional conversation UX, speaker lanes, event controls, and organizer-managed translation. Source: `docs/spec.md`.

## 3. Shipped features and planned-but-unshipped work

“Shipped” below means implemented in the current app/Worker path or stated as an existing change in the current changelog. It does not prove that every uncommitted change is already present in a public store build.

### Implemented in the current product path

- **Live translated captions:** microphone audio is streamed during a live session, OpenAI Realtime returns source and translated deltas, and the app renders them locally. Sources: `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/worker/src/sockets/realtime.ts`, `apps/worker/src/providers/openaiRealtime.ts`.
- **Live session captions:** short exchanges and ongoing speech use the same realtime session; committed translated text remains ordered while tentative text stays local until it is complete. Sources: `packages/protocol/src/transport/types.ts`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/mobile/src/home/translationSurface.tsx`.
- **Source-language selection:** the source picker supports an **Auto detect** option and fixed source languages. Sources: `packages/protocol/src/languages.ts`, `apps/mobile/src/home/languagePicker.tsx`, `apps/worker/src/routes/session.ts`.
- **Language selection:** the current code registry supports English, Arabic, Spanish, French, German, Italian, Portuguese (Brazil), Japanese, Simplified Chinese, Korean, Russian, Hindi, and Dutch. It supports searchable source/target pickers, language swapping when a fixed source is selected, and RTL rendering for Arabic. Source: `packages/protocol/src/languages.ts`, `apps/mobile/src/home/languagePicker.tsx`, `apps/mobile/src/home/translationSurface.tsx`.
- **Optional translated speech:** OpenAI Realtime can return target-language speech during a live session. Users can turn translated audio off from the translation screen while source and translated captions keep running. Sources: `apps/worker/src/providers/openaiRealtime.ts`, `apps/worker/src/sockets/realtime.ts`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/mobile/src/home/variants/bloom/index.tsx`.
- **Start, stop, cancel, reconnect, and limits:** users can start and stop sessions, cancel active capture/playback, and the runtime has transport-recovery paths. The Worker enforces active-session, session-duration, per-install, span-length, concurrency, and per-minute translation limits. Sources: `apps/mobile/src/home/homeScreen.tsx`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/worker/src/limits.ts`.
- **In-app translation reporting:** users can report inaccurate, harmful/offensive, wrong-language, speech, or other issues; text snapshots are optional. Sources: `apps/mobile/src/home/diagnosticsModal.tsx`, `apps/mobile/src/lib/providers/reportTranslation.ts`, `apps/worker/src/routes/report.ts`.
- **Accountless privacy controls:** there is no login or profile; the app offers **Reset Murmur Identity** and **Delete Local Data**. Sources: `apps/mobile/src/home/settingsModals.tsx`, `apps/mobile/src/lib/installIdentity.ts`, `apps/mobile/src/lib/engagement.ts`.
- **Secondary UX/features:** the Bloom UI direction, an in-app Murmur share action, and a native rating request after qualifying successful sessions. Session diagnostics remain available only in developer builds. Sources: `apps/mobile/src/home/experience.tsx`, `apps/mobile/src/home/diagnosticsModal.tsx`, `apps/mobile/src/lib/shareMurmur.ts`, `apps/mobile/src/lib/engagement.ts`.

### Planned, experimental, or not yet safe to describe as shipped

- **Longer live-caption store captures:** the Android and iOS screenshot notes say a future capture pass should add a longer live-caption session before store publication. Sources: `apps/mobile/fastlane/metadata/android/en-US/images/phoneScreenshots/README.md`, `apps/mobile/fastlane/metadata/en-US/screenshots.md`.
- **Arabic and other interface localization:** the growth plan says the interface and support surfaces are currently English-only and recommends Arabic localization before Arabic-language acquisition. Source: `docs/growth-and-aso-strategy.md`.
- **Custom store pages, product-page experiments, and paid campaigns:** the growth plan describes these as future work. Murmur now sends fixed, content-free product events through its Worker to PostHog US and uses Sentry for sanitized reliability diagnostics. Sources: `docs/growth-and-aso-strategy.md`, `docs/legal/observability-data-map.md`.
- **Single realtime service path:** the shipping Worker uses OpenAI Realtime for speech, captions, and translated audio; no alternate translation route is part of the product contract. Sources: `apps/worker/src/providers/openaiRealtime.ts`, `apps/worker/src/sockets/realtime.ts`, `apps/worker/src/routes/session.ts`.
- **Language coverage:** the current `languageRegistry` contains 13 language codes, and the store descriptions list those same 13 languages. Sources: `apps/mobile/fastlane/metadata/en-US/description.txt`, `apps/mobile/fastlane/metadata/android/en-US/full_description.txt`, `packages/protocol/src/languages.ts`.

## 4. Differentiators versus likely competitors

These are repository-supported positioning differences, not claims of market exclusivity or independently verified competitor performance.

- **Individual attendee workflow:** the repository contrasts Murmur with Google Translate, iTranslate, Apple Translate, Wordly, KUDO, and Interprefy. Its intended opening is an attendee who can start listening without organizer setup, access links, event feeds, or enterprise purchase workflows. Source: `docs/growth-and-aso-strategy.md`.
- **Text-first live experience:** Murmur treats readable translated captions as the primary output and lets speech output degrade separately. That gives it a narrower focus than general translators that also cover camera, text, phrasebooks, or offline features. Sources: `docs/spec.md`, `apps/mobile/src/home/errorCopy.ts`, `docs/growth-and-aso-strategy.md`.
- **Short exchange to ongoing talk:** the same live session handles short turns and longer explanations while committed captions remain ordered. Sources: `apps/mobile/src/home/translationSurface.tsx`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`.
- **Accountless by design:** no login, profile, or saved cloud transcript history is part of the V1 contract, with local reset/delete controls. Sources: `docs/spec.md`, `docs/legal/privacy-policy.md`.
- **Privacy-aware service boundary:** the OpenAI API key remains server-side, the Worker hashes the install identifier, and default logs redact audio, captions, credentials, and report snapshots. Sources: `README.md`, `apps/worker/src/privacy.ts`, `docs/legal/privacy-policy.md`.

## 5. Monetization

**No monetization was found in the current product.** The product spec explicitly defines V1 as free with no subscriptions, external payment links, or paid digital features. The App Store review notes also say no subscription is required, and no billing, IAP, paywall, or advertising dependency/code path was found in the mobile manifest or source. Sources: `docs/spec.md`, `apps/mobile/fastlane/metadata/en-US/review_information/notes.txt`, `apps/mobile/package.json`, `apps/mobile/app.json`.

The Worker does enforce usage limits, so “unlimited” is not supported by the repository even though no user-facing price or paid tier exists. Source: `apps/worker/src/limits.ts`.

## 6. Privacy posture

- **Account:** no account, login, profile, password, subscription account, or cloud transcript library is required. The app creates an anonymous install ID in platform secure storage, and the Worker hashes it for rate limits, abuse prevention, diagnostics, session authorization, and pseudonymous measurement. Sources: `docs/legal/privacy-policy.md`, `apps/mobile/src/lib/installIdentity.ts`, `apps/mobile/src/lib/localStorage.ts`, `apps/worker/src/privacy.ts`.
- **Tracking and analytics:** the iOS privacy manifest sets `NSPrivacyTracking` to `false` and declares no tracking domains. Murmur sends fixed, content-free product events through its Worker to PostHog US, hashes the install identifier before forwarding, and provides an Anonymous Analytics opt-out. Sentry receives sanitized reliability diagnostics. Sources: `apps/mobile/app.json`, `docs/legal/privacy-policy.md`, `docs/legal/observability-data-map.md`.
- **Network/offline:** no offline translation path or on-device translation engine was found. A session requires the Murmur Worker and OpenAI Realtime, and the app reports worker/network failures. Sources: `apps/mobile/src/lib/live-translation/workerApi.ts`, `apps/worker/src/index.ts`, `apps/worker/src/sockets/realtime.ts`, `apps/mobile/src/home/errorCopy.ts`, `docs/growth-and-aso-strategy.md`.
- **On-device processing:** the native module captures and converts audio locally to PCM frames, but speech recognition, translation, and optional speech output run through OpenAI Realtime. Murmur says it does not retain audio or transcript history by default; reports may include text snapshots only when explicitly sent. Sources: `apps/mobile/modules/murmur-audio/`, `apps/worker/src/providers/openaiRealtime.ts`, `docs/legal/privacy-policy.md`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`.
- **Third-party processors:** Cloudflare provides the Worker gateway, and OpenAI Realtime provides live transcription, translation, and translated speech. Source: `docs/legal/privacy-policy.md`.
- **Permissions and native capabilities:** iOS requests microphone access and declares an audio background capability. Android declares `RECORD_AUDIO`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_MICROPHONE`; storage, biometric, vibration, and overlay permissions are blocked in the Expo config. Source: `apps/mobile/app.json`.
- **Background behavior caveat:** current code and reviewer notes preserve an active session when the app backgrounds, while `docs/spec.md` still says V1 should be foreground-only. Do not make a background/lock-screen claim until this conflict is resolved and real-device behavior is verified. Sources: `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/mobile/fastlane/metadata/en-US/review_information/notes.txt`, `docs/spec.md`.
- **Policy maturity:** the checked-in privacy policy, terms, and support pages describe the current OpenAI Realtime and Cloudflare data flow; retention remains limited to the operational metadata and report records described in those pages. Sources: `docs/legal/privacy-policy.md`, `docs/legal/terms.md`, `docs/legal/support-and-deletion.md`.

## 7. Existing listing text and store assets

### Existing listing text

The repository contains English App Store metadata in `apps/mobile/fastlane/metadata/en-US/` and Google Play metadata in `apps/mobile/fastlane/metadata/android/en-US/` and `en-GB/`.

Exact text already present:

> **App Store name / Google Play title:** “Murmur: Live Voice Translator”

> **App Store subtitle:** “Captions for travel & talks”

> **App Store promotional text:** “Follow tours, talks, lectures, and conferences in another language with live translated captions—no account required.”

> **Google Play short description:** “Live translated captions for tours, talks, and conferences. No account needed.”

The long descriptions open with:

> “Follow spoken language as it happens.”

They describe live translated captions, optional translated speech, source/target language controls, in-app translation reporting, no account, no saved cloud transcript history, and AI accuracy limits. Sources: `apps/mobile/fastlane/metadata/en-US/description.txt`, `apps/mobile/fastlane/metadata/android/en-US/full_description.txt`.

The current App Store keyword field is:

> `interpreter,conference,meeting,event,tour,lecture,arabic,urdu,hindi,spanish,french,german,transcribe`

The current release note says:

> “Rebuilds live translation on OpenAI Realtime Translation for streaming source captions, translated captions, and translated speech in one experience.”

Sources: `apps/mobile/fastlane/metadata/en-US/keywords.txt`, `apps/mobile/fastlane/metadata/en-US/release_notes.txt`, `apps/mobile/fastlane/metadata/android/en-US/changelogs/default.txt`.

### Existing assets

- The previous iOS and Google Play screenshot sets, source captures, compositions, and screenshot-derived social assets were removed while the screenshot redesign is pending. See `apps/mobile/store-assets/SCREENSHOTS_PENDING_REDESIGN.md`.
- A 1024×500 Google Play feature graphic remains under `apps/mobile/fastlane/metadata/android/`.
- Source branding includes an app icon, Google Play icon, feature-graphic SVG, and dated logo concepts under `apps/mobile/store-assets/source/brand/` and `source/google-play/`.

## 8. Likely category and search keywords

The repository’s ASO plan recommends **Travel** as the primary category and **Utilities** as secondary, while noting that the existing public App Store listing is in Utilities. This is a recommendation, not a confirmed current category in a store console. Source: `docs/growth-and-aso-strategy.md`.

Realistic search terms based on implemented behavior and the repository’s own search research:

1. live translator
2. voice translator
3. speech translator
4. live captions
5. translated captions
6. real time translation
7. Arabic translator
8. travel translator
9. tour translator
10. lecture translator
11. conference translator
12. talk translator
13. language interpreter
14. spoken translation
15. ongoing live translation

Do not turn the keyword list into claims about ranking or search volume. The growth document says the current traffic is too low for reliable ASO decisions. Source: `docs/growth-and-aso-strategy.md`.

## 9. Claims to avoid

- **“Supports 15 languages,” or listing Urdu, Turkish, and Indonesian:** the current code registry exposes 13 languages and does not contain those three. Resolve the metadata/code mismatch first. Sources: `packages/protocol/src/languages.ts`, `apps/mobile/fastlane/metadata/en-US/description.txt`.
- **“Works offline,” “on-device translation,” or “your audio never leaves your phone”:** live sessions require the Worker and OpenAI Realtime, and microphone audio passes through the Worker to that service. Sources: `apps/mobile/src/lib/live-translation/workerApi.ts`, `apps/worker/src/sockets/realtime.ts`, `docs/legal/privacy-policy.md`.
- **“Two-way conversation,” “automatic interpreter,” or “translates both speakers”:** the product is one-way and the spec excludes bidirectional conversation UX. Sources: `docs/spec.md`, `packages/protocol/src/transport/types.ts`.
- **Camera, image, text, or document translation:** no such product path was found. The repository’s own competitor analysis identifies these as capabilities of broader competitor products. Source: `docs/growth-and-aso-strategy.md`.
- **Organizer-managed event translation, direct event audio feeds, speaker lanes, or enterprise event controls:** those are explicitly outside Murmur’s product shape. Source: `docs/spec.md`.
- **Perfect, instant, professional, human-level, or guaranteed-accurate translation:** the terms, privacy policy, and store descriptions disclose delayed, incomplete, inaccurate, offensive, or unavailable AI output and warn against high-stakes reliance. Sources: `docs/legal/terms.md`, `apps/mobile/fastlane/metadata/android/en-US/full_description.txt`.
- **“No data is collected” or “no tracking of any kind”:** the app processes anonymous install/session metadata, campaign tags, diagnostics, latency data, product interaction, and device ID according to the checked-in privacy manifest/policy. Sources: `apps/mobile/app.json`, `docs/legal/privacy-policy.md`.
- **“No data is stored” without qualification:** Murmur says audio and transcript history are not retained by default, but anonymous operational metadata, local engagement state, and some translation reports can be retained. Source: `docs/legal/privacy-policy.md`.
- **“Unlimited use”:** the Worker enforces session and translation limits, including a 15-minute maximum session, one active session per install, and per-install session caps. Source: `apps/worker/src/limits.ts`.
- **“Translated speech always available”:** speech output is optional and configuration-dependent, while readable captions remain the primary path. Sources: `apps/worker/src/sockets/realtime.ts`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/mobile/src/home/errorCopy.ts`.
- **“Runs in the background” or “works from the lock screen”:** current code/config and review notes suggest active background continuation, but the V1 spec says foreground-only. Resolve and verify the platform behavior first. Sources: `apps/mobile/app.json`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `docs/spec.md`.
- **“Free forever” or a paid plan:** no paid path is present, but the repository only establishes the current V1 monetization state, not a permanent pricing promise. Source: `docs/spec.md`.
