<!-- cspell:words Wordly Interprefy -->

# Murmur app-store product brief

Scope: factual research from the current repository state on 2026-08-01. This is a product brief for a copywriter, not proposed store copy. The worktree contains uncommitted product and store-metadata changes, so public-store status should be checked separately before publication.

## 1. App name, IDs, platforms, and tech stack

- **Name:** Murmur. The app config and store title use `Murmur`; the current version is `1.1.0`. Sources: `apps/mobile/app.json`, `apps/mobile/fastlane/metadata/en-US/name.txt`, `package.json`.
- **iOS:** bundle ID `com.q9labsai.murmur`; App Store app ID `6756962206`. iPad support is explicitly disabled. Source: `apps/mobile/app.json`.
- **Android:** package ID `com.q9labsai.murmur`; Google Play URL is present; current Android version code is `3`. Sources: `apps/mobile/app.json`, `apps/mobile/eas.json`.
- **Platforms it actually targets:** iOS and Android have store build profiles, submission metadata, store URLs, and platform-specific permissions/assets. Expo web support and a browser audio module exist in code, but no web store target or web product listing was found. Sources: `apps/mobile/eas.json`, `apps/mobile/fastlane/`, `apps/mobile/modules/murmur-audio/src/MurmurAudioModule.web.ts`.
- **Mobile stack:** Expo `~54.0.35`, React Native `0.81.5`, React `19.1.0`, Expo Router, TypeScript, and pnpm. Source: `apps/mobile/package.json`, `package.json`.
- **Realtime/backend stack:** a Cloudflare Worker with a Durable Object rate/session store and WebSocket endpoints. The Worker keeps provider secrets off the device, creates sessions, proxies speech recognition, streams translation, brokers short-lived tokens, and accepts translation reports. Sources: `README.md`, `apps/worker/src/index.ts`, `apps/worker/src/routes/session.ts`, `apps/worker/src/rateLimitDurableObject.ts`.
- **AI/audio providers:** Deepgram Nova-3 for streaming speech recognition, OpenRouter using Gemma `google/gemma-4-26b-a4b-it` for translation, and optional Cartesia speech generation. Source: `apps/worker/src/sockets/deepgram.ts`, `apps/worker/src/providers/openrouter.ts`, `apps/worker/src/providers/tokens.ts`, `apps/worker/wrangler.toml`.
- **Native audio:** a custom Expo module with Swift for iOS, Kotlin/Android for Android, and a Web Audio implementation for web. It captures mono PCM16 at 16 kHz and can stream PCM speech playback. Sources: `apps/mobile/modules/murmur-audio/`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`.

## 2. What the app does, the problem, and the target user

Murmur is a one-way live speech translator. The user chooses a source language and target language, taps **Listen**, speaks or listens to one speaker, and receives source/translated captions as speech is recognized and translated. Stable translated phrases can also be played as target-language speech when that provider path is available. Sources: `README.md`, `docs/spec.md`, `apps/mobile/src/home/onboarding.tsx`, `apps/mobile/src/home/translationSurface.tsx`.

The core problem is following ongoing spoken content in another language without waiting for an organizer-managed interpretation setup. The repository positions the product around tours, talks, lectures, classes, demonstrations, sermons, workshops, and conferences, with the individual attendee or traveler as the user. Sources: `apps/mobile/fastlane/metadata/en-US/description.txt`, `docs/growth-and-aso-strategy.md`.

The product is deliberately one-directional. The spec excludes bidirectional conversation UX, speaker lanes, event controls, and organizer-managed translation. Source: `docs/spec.md`.

## 3. Shipped features and planned-but-unshipped work

“Shipped” below means implemented in the current app/Worker path or stated as an existing change in the current changelog. It does not prove that every uncommitted change is already present in a public store build.

### Implemented in the current product path

- **Live translated captions:** microphone audio is streamed during a live session, speech is recognized, stable source spans are sent for translation, and translated text is rendered in the app. Sources: `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/worker/src/sockets/deepgram.ts`, `apps/worker/src/sockets/translate.ts`.
- **Phrase Mode:** short speech turns are translated as phrase-sized spans. Source: `packages/protocol/src/transport/types.ts`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`.
- **Continuous Mode:** ongoing speech is stabilized into ordered spans and displayed in a scrollable session timeline, with tentative source text shown separately until committed. Sources: `docs/continuous-mode-spec.md`, `apps/mobile/src/home/translationSurface.tsx`, `apps/mobile/src/lib/continuousTranslationScheduler.ts`.
- **Source-language auto-detection:** the source picker has an **Auto detect** option and the Worker maps it to Deepgram’s multilingual mode. Sources: `packages/protocol/src/languages.ts`, `apps/mobile/src/home/languagePicker.tsx`, `apps/worker/src/sockets/deepgram.ts`.
- **Language selection:** the current code registry supports English, Arabic, Spanish, French, German, Italian, Portuguese (Brazil), Japanese, Simplified Chinese, Korean, Russian, Hindi, and Dutch. It supports searchable source/target pickers, language swapping when a fixed source is selected, and RTL rendering for Arabic. Source: `packages/protocol/src/languages.ts`, `apps/mobile/src/home/languagePicker.tsx`, `apps/mobile/src/home/translationSurface.tsx`.
- **Optional translated speech:** Cartesia can generate and play target-language speech for stable translated phrases when configured. Captions remain available when speech is unavailable. Sources: `apps/worker/src/providers/tokens.ts`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/mobile/src/home/errorCopy.ts`.
- **Start, stop, cancel, reconnect, and limits:** users can start and stop sessions, cancel active capture/playback, and the runtime has token refresh and transport-recovery paths. The Worker enforces active-session, session-duration, per-install, span-length, concurrency, and per-minute translation limits. Sources: `apps/mobile/src/home/homeScreen.tsx`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/worker/src/limits.ts`.
- **In-app translation reporting:** users can report inaccurate, harmful/offensive, wrong-language, speech, or other issues; text snapshots are optional. Sources: `apps/mobile/src/home/diagnosticsModal.tsx`, `apps/mobile/src/lib/providers/reportTranslation.ts`, `apps/worker/src/routes/report.ts`.
- **Accountless privacy controls:** there is no login or profile; the app offers **Reset Murmur Identity** and **Delete Local Data**. Sources: `apps/mobile/src/home/settingsModals.tsx`, `apps/mobile/src/lib/installIdentity.ts`, `apps/mobile/src/lib/engagement.ts`.
- **Secondary UX/features:** four selectable UI styles, session diagnostics with latency data and copy/download/share actions, an in-app Murmur share action, and a native rating request after qualifying successful sessions. Sources: `apps/mobile/src/home/experience.tsx`, `apps/mobile/src/home/settingsModals.tsx`, `apps/mobile/src/home/diagnosticsModal.tsx`, `apps/mobile/src/lib/shareMurmur.ts`, `apps/mobile/src/lib/engagement.ts`, `CHANGELOG.md`.

### Planned, experimental, or not yet safe to describe as shipped

- **Longer Continuous Mode store captures:** the Android and iOS screenshot notes explicitly say a future capture pass should add a longer Continuous Mode session before store publication. Sources: `apps/mobile/fastlane/metadata/android/en-US/images/phoneScreenshots/README.md`, `apps/mobile/fastlane/metadata/en-US/screenshots.md`.
- **Arabic and other interface localization:** the growth plan says the interface and support surfaces are currently English-only and recommends Arabic localization before Arabic-language acquisition. Source: `docs/growth-and-aso-strategy.md`.
- **Custom store pages, product-page experiments, paid campaigns, and deeper product analytics:** the growth plan describes these as future work or says they were not performed; it also says there is no acquisition/product analytics SDK in the mobile app. Source: `docs/growth-and-aso-strategy.md`.
- **Alternative provider routes:** Groq, Cerebras, and Ultravox routes are marked as development or experiment routes and are not the default product route. Sources: `packages/protocol/src/translationModelRoutes.ts`, `apps/mobile/src/home/settingsModals.tsx`.
- **Important language mismatch:** store descriptions claim 15 languages and list Urdu, Turkish, and Indonesian, but the current `languageRegistry` contains 13 codes and none of those three. Sources: `apps/mobile/fastlane/metadata/en-US/description.txt`, `apps/mobile/fastlane/metadata/android/en-US/full_description.txt`, `packages/protocol/src/languages.ts`. Resolve this before using a language count or full language list.

## 4. Differentiators versus likely competitors

These are repository-supported positioning differences, not claims of market exclusivity or independently verified competitor performance.

- **Individual attendee workflow:** the repository contrasts Murmur with Google Translate, iTranslate, Apple Translate, Wordly, KUDO, and Interprefy. Its intended opening is an attendee who can start listening without organizer setup, access links, event feeds, or enterprise purchase workflows. Source: `docs/growth-and-aso-strategy.md`.
- **Text-first live experience:** Murmur treats readable translated captions as the primary output and lets speech output degrade separately. That gives it a narrower focus than general translators that also cover camera, text, phrasebooks, or offline modes. Sources: `docs/spec.md`, `apps/mobile/src/home/errorCopy.ts`, `docs/growth-and-aso-strategy.md`.
- **Short phrase to ongoing talk:** Phrase Mode handles short turns while Continuous Mode keeps an ordered caption timeline for a longer explanation. Sources: `docs/continuous-mode-spec.md`, `apps/mobile/src/home/translationSurface.tsx`.
- **Accountless by design:** no login, profile, or saved cloud transcript history is part of the V1 contract, with local reset/delete controls. Sources: `docs/spec.md`, `docs/legal/privacy-policy.md`.
- **Privacy-aware service boundary:** provider keys remain server-side, the Worker hashes the install identifier, and default logs redact audio, captions, tokens, and report snapshots. Sources: `README.md`, `apps/worker/src/privacy.ts`, `docs/legal/privacy-policy.md`.

## 5. Monetization

**No monetization was found in the current product.** The product spec explicitly defines V1 as free with no subscriptions, external payment links, or paid digital features. The App Store review notes also say no subscription is required, and no billing, IAP, paywall, or advertising dependency/code path was found in the mobile manifest or source. Sources: `docs/spec.md`, `apps/mobile/fastlane/metadata/en-US/review_information/notes.txt`, `apps/mobile/package.json`, `apps/mobile/app.json`.

The Worker does enforce usage limits, so “unlimited” is not supported by the repository even though no user-facing price or paid tier exists. Source: `apps/worker/src/limits.ts`.

## 6. Privacy posture

- **Account:** no account, login, profile, password, subscription account, or cloud transcript library is required. The app creates an anonymous install ID in platform secure storage, and the Worker hashes it for rate limits, abuse prevention, diagnostics, token minting, and pseudonymous measurement. Sources: `docs/legal/privacy-policy.md`, `apps/mobile/src/lib/installIdentity.ts`, `apps/mobile/src/lib/localStorage.ts`, `apps/worker/src/privacy.ts`.
- **Tracking and analytics:** the iOS privacy manifest sets `NSPrivacyTracking` to `false` and declares no tracking domains, but it declares product-interaction and device-ID data for analytics/functionality. The app has privacy-conscious campaign attribution, local engagement/rating state, and diagnostics/latency telemetry; the growth plan says there is no acquisition or product analytics SDK. Sources: `apps/mobile/app.json`, `docs/legal/privacy-policy.md`, `apps/mobile/src/lib/acquisition.ts`, `apps/mobile/src/lib/engagement.ts`, `docs/growth-and-aso-strategy.md`.
- **Network/offline:** no offline translation path or on-device translation model was found. A session requires the Murmur Worker plus remote speech-recognition and translation providers, and the app reports worker/network failures. Sources: `apps/mobile/src/lib/live-translation/workerApi.ts`, `apps/worker/src/index.ts`, `apps/mobile/src/home/errorCopy.ts`, `docs/growth-and-aso-strategy.md`.
- **On-device processing:** the native module captures and converts audio locally to PCM frames, but speech recognition, translation, and optional speech generation are remote. Murmur says it does not retain audio or transcript history by default; reports may include text snapshots only when explicitly sent. Sources: `apps/mobile/modules/murmur-audio/`, `apps/worker/src/sockets/deepgram.ts`, `docs/legal/privacy-policy.md`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`.
- **Third-party processors:** Cloudflare, Deepgram, OpenRouter/routed model providers, and optional Cartesia are named in the privacy policy. Source: `docs/legal/privacy-policy.md`.
- **Permissions and native capabilities:** iOS requests microphone access and declares an audio background mode. Android declares `RECORD_AUDIO`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_MICROPHONE`; storage, biometric, vibration, and overlay permissions are blocked in the Expo config. Source: `apps/mobile/app.json`.
- **Background behavior caveat:** current code and reviewer notes preserve an active session when the app backgrounds, while `docs/spec.md` still says V1 should be foreground-only. Do not make a background/lock-screen claim until this conflict is resolved and real-device behavior is verified. Sources: `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/mobile/fastlane/metadata/en-US/review_information/notes.txt`, `docs/spec.md`.
- **Policy maturity:** the checked-in privacy policy, terms, and support pages are labeled drafts in their headings or text, and the policy says provider retention settings still need final verification. Sources: `docs/legal/privacy-policy.md`, `docs/legal/terms.md`, `docs/legal/support-and-deletion.md`.

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

They describe live translated captions, Phrase Mode, Continuous Mode, optional translated speech, source/target language controls, in-app translation reporting, no account, no saved cloud transcript history, and AI accuracy limits. Sources: `apps/mobile/fastlane/metadata/en-US/description.txt`, `apps/mobile/fastlane/metadata/android/en-US/full_description.txt`.

The current App Store keyword field is:

> `interpreter,conference,meeting,event,tour,lecture,arabic,urdu,hindi,spanish,french,german,transcribe`

The current release note says:

> “Improves live translation with auto-detect source language, Continuous Mode, steadier in-progress captions, and a refreshed default translation route for faster testing feedback.”

Sources: `apps/mobile/fastlane/metadata/en-US/keywords.txt`, `apps/mobile/fastlane/metadata/en-US/release_notes.txt`, `apps/mobile/fastlane/metadata/android/en-US/changelogs/default.txt`.

### Existing assets

- iOS metadata contains seven screenshots under `apps/mobile/fastlane/metadata/en-US/screenshots/`.
- Google Play metadata contains five phone screenshots and a 1024×500 feature graphic for both `en-US` and `en-GB` under `apps/mobile/fastlane/metadata/android/`.
- Source captures exist under `apps/mobile/store-assets/source/screenshots/ios/` and `android-captures/`, with generated abstract compositions under `apps/mobile/store-assets/source/store-screenshot-compositions/`.
- Source branding includes an app icon, Google Play icon, feature-graphic SVG, and dated logo concepts under `apps/mobile/store-assets/source/brand/` and `source/google-play/`.
- Generated 1080×1920 social assets exist under `apps/mobile/store-assets/generated/social/instagram/`.

The asset notes say the current screenshot sets pair verified app captures with generated abstract compositions, and explicitly warn that a longer Continuous Mode capture is still a future capture pass. Sources: `apps/mobile/fastlane/metadata/en-US/screenshots.md`, `apps/mobile/fastlane/metadata/android/en-US/images/phoneScreenshots/README.md`, `apps/mobile/store-assets/generated/social/instagram/README.md`.

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
14. phrase translator
15. continuous translation

Do not turn the keyword list into claims about ranking or search volume. The growth document says the current traffic is too low for reliable ASO decisions. Source: `docs/growth-and-aso-strategy.md`.

## 9. Claims to avoid

- **“Supports 15 languages,” or listing Urdu, Turkish, and Indonesian:** the current code registry exposes 13 languages and does not contain those three. Resolve the metadata/code mismatch first. Sources: `packages/protocol/src/languages.ts`, `apps/mobile/fastlane/metadata/en-US/description.txt`.
- **“Works offline,” “on-device translation,” or “your audio never leaves your phone”:** live sessions require the Worker and remote providers, and microphone audio is sent to Deepgram. Sources: `apps/mobile/src/lib/live-translation/workerApi.ts`, `apps/worker/src/sockets/deepgram.ts`, `docs/legal/privacy-policy.md`.
- **“Two-way conversation,” “automatic interpreter,” or “translates both speakers”:** the product is one-way and the spec excludes bidirectional conversation UX. Sources: `docs/spec.md`, `packages/protocol/src/transport/types.ts`.
- **Camera, image, text, or document translation:** no such product path was found. The repository’s own competitor analysis identifies these as capabilities of broader competitor products. Source: `docs/growth-and-aso-strategy.md`.
- **Organizer-managed event translation, direct event audio feeds, speaker lanes, or enterprise event controls:** those are explicitly outside Murmur’s product shape. Source: `docs/spec.md`.
- **Perfect, instant, professional, human-level, or guaranteed-accurate translation:** the terms, privacy policy, and store descriptions disclose delayed, incomplete, inaccurate, offensive, or unavailable AI output and warn against high-stakes reliance. Sources: `docs/legal/terms.md`, `apps/mobile/fastlane/metadata/android/en-US/full_description.txt`.
- **“No data is collected” or “no tracking of any kind”:** the app processes anonymous install/session metadata, campaign tags, diagnostics, latency data, product interaction, and device ID according to the checked-in privacy manifest/policy. Sources: `apps/mobile/app.json`, `docs/legal/privacy-policy.md`.
- **“No data is stored” without qualification:** Murmur says audio and transcript history are not retained by default, but anonymous operational metadata, local engagement state, and some translation reports can be retained. Source: `docs/legal/privacy-policy.md`.
- **“Unlimited use”:** the Worker enforces session and translation limits, including a 15-minute maximum session, one active session per install, and per-install session caps. Source: `apps/worker/src/limits.ts`.
- **“Translated speech always available,” especially for Continuous Mode:** speech is optional/configuration-dependent, and current Continuous Mode code defers speech to keep text translation on the critical path. Sources: `apps/worker/src/routes/session.ts`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `apps/mobile/src/home/errorCopy.ts`.
- **“Runs in the background” or “works from the lock screen”:** current code/config and review notes suggest active background continuation, but the V1 spec says foreground-only. Resolve and verify the platform behavior first. Sources: `apps/mobile/app.json`, `apps/mobile/src/lib/live-translation/useLiveTranslation.ts`, `docs/spec.md`.
- **“Free forever” or a paid plan:** no paid path is present, but the repository only establishes the current V1 monetization state, not a permanent pricing promise. Source: `docs/spec.md`.
