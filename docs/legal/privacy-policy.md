# Murmur Privacy Policy

Last updated: 2026-09-23

Murmur is a one-way live speech translator operated by Q9 Labs. You choose languages and an available audio source, tap Listen, and Murmur shows translated captions. Microphone mode can also play translated speech.

## Live Translation

Before a live session starts, Murmur asks you to allow the selected live audio to be sent through Murmur's servers to a third-party AI service provider for speech recognition and translation. In Microphone mode, Murmur captures microphone audio only while a session you started is active. On supported Android devices, Phone audio mode captures eligible media playback after you approve Android's audio-recording and screen-sharing prompts; it does not capture the microphone in that mode.

The AI service returns source and translated captions through Murmur's servers. Captions are displayed on your device and are not saved as a transcript history by default. Murmur does not save captured audio by default. Translated speech, when available, is returned for local playback.

On Android, floating captions can appear in a system overlay after you allow Murmur to display over other apps. The overlay is rendered locally and does not create another server copy of the captions.

## Optional AI Session Insights

After your first completed session, Murmur asks whether you want AI session insights. This is a separate, optional choice from live translation and Anonymous Analytics. You can decline and continue using translation, or change your choice in Settings. The choice starts off.

If you consent, Murmur creates an insight only for a session with at least 30 seconds of translation. Murmur's server keeps the session transcript text in memory while the session is active. At the end of an eligible session, it sends that text to a third-party AI service provider to derive a short record. The record may include the kind of setting, an event name if spoken, the topic, domain terms, an estimated speaker count, apparent user intent, a translation-quality score, possible confusing words or phrases, general sentiment, a short summary, and brief product feedback signals.

Murmur keeps the derived insight, not the transcript. The transcript is discarded after processing and is never written to Murmur storage or logs. The retained record is associated with a hashed install identifier, app session identifier, language pair, session duration, and creation time. Murmur retains each insight for up to 24 months from creation, then deletes it.

Turning off AI session insights stops future insight processing; it does not automatically delete insights already created. To request deletion of an existing insight, contact support with the approximate session date and any available session or report receipt details. Avoid speaking sensitive or identifying information if you do not want it reflected in a derived insight.

## Accounts, Sign-In, and Purchases

Murmur creates a random guest customer identifier so it can provide Free time, track usage, and manage purchases. You can purchase, restore, and reconcile a purchase as a guest; an email or registered account is not required. If you choose to save a guest purchase to an account, Murmur links the guest's purchase and remaining balance to that account so you can recover them on another device.

You may save a purchase by signing in with Apple, Google, or email. For Apple or Google sign-in, Murmur receives your email address (which may be a private relay address, depending on your Apple choice) and that provider's stable account identifier. Murmur stores the sign-in records needed to maintain your account and link your customer record. Email sign-in uses your email address to deliver a one-time code. Murmur does not receive your Apple or Google password.

Murmur stores plan state, credit grants, usage debits, renewal, restore and refund records, and store transaction identifiers in an entitlement ledger. The applicable app store and a payment and subscription provider validate and manage purchases. Murmur does not receive or store payment-card details.

## Install, Session, and Connection Data

The app stores an anonymous install identifier and a separate Free-allowance identifier in platform secure storage. Murmur's server hashes these identifiers for diagnostics, pseudonymous measurement, and abuse prevention. Reset Murmur Identity replaces the diagnostic install identifier. Delete Local Data removes local identifiers; a hashed current-month Free claim may remain on the server through that allowance period to prevent duplicate grants.

Murmur may process short, allowlisted source, medium, campaign, content, partner, or landing-page labels from tagged links. It also measures install source: on Android, Murmur reads the Play Install Referrer at first launch; on iOS, Murmur obtains an Apple AdServices attribution token and sends it to Apple's attribution service to resolve campaign information. Murmur uses the resulting source or campaign information to measure which campaigns lead to installs and use. This is not used to build an advertising profile or to track you across other companies' apps or websites. Turning Anonymous Analytics off stops forwarding new install-attribution information to product analytics.

Murmur may include the country derived from your network connection with relayed analytics events. It uses country only, not city or region, and does not collect precise location. For rate limiting, the server separately hashes the connecting network address and keeps request timestamps under that hash for up to one hour; it does not send the address or that abuse-prevention hash to product analytics or crash diagnostics.

## Analytics, Session Replay, and Diagnostics

Anonymous Analytics is on by default and can be turned off in Settings. Analytics events may describe app and build version, platform, language pair, onboarding steps, plan and offer interactions, sign-in method, session outcome, background use, capture source, broad network type, timing, duration, bounded error categories, and install source. They may include a star rating, your answer to the question “What did you use Murmur for?”, and the platform when Murmur requests a store review. If you choose “Other,” your optional written answer may also be sent. Please do not include sensitive or identifying information in that answer.

When you allow AI session insights, Murmur may send a separate session-insight event containing only enum and numeric fields, not the free-text summary or transcript. If Anonymous Analytics is off, Murmur stops new product analytics events, install-attribution reporting, and session replay. Essential sanitized crash and error monitoring can continue. This analytics control does not turn off AI session insights; use the separate AI session insights setting to stop future summaries.

Murmur uses session replay to understand app interactions. Replay captures app screens and interactions, not microphone audio. Before replay is sent, Murmur masks all text inputs and the translation and transcript text views. Replay follows the Anonymous Analytics setting and is off when analytics is off. The replay SDK does not duplicate events sent through Murmur's analytics relay.

Murmur also processes sanitized crash, error, and sampled performance diagnostics, such as a stack trace, bounded operation or error category, app release, environment, app session identifier, and limited timing data. Diagnostics do not include conversation content, request bodies, cookies, query strings, or user fields.

## Ratings, Survey Answers, and Translation Reports

After qualifying sessions, Murmur may ask for a five-star in-app rating and the optional question “What did you use Murmur for?” Answers use a short list of use-case categories, with an optional “Other” text response. Murmur records the star rating and answer to understand how the app is used and improve it. Native store-review prompts are separate from the in-app rating.

Murmur stores a qualified-session count and the version and time of its last native rating request on your device so it can time prompts and avoid asking repeatedly. This local state contains no audio or caption text.

You can report an inaccurate, wrong-language, harmful, speech-related, or other translation issue. A report includes session and translation-span metadata. It may include text snapshots only when the app explicitly sends them. A report receipt can help support locate a report for a follow-up or deletion request.

## Third-Party Service Providers

Murmur uses third-party services in these categories: a cloud hosting and infrastructure provider for Murmur's server, database, rate limits, and privacy-safe logs; a third-party AI service provider for live speech recognition, translation, translated speech, and consent-based session insights; an analytics provider for product analytics and masked session replay; a diagnostics provider for sanitized crash and performance monitoring; a payment and subscription provider and the relevant app stores for purchase validation and lifecycle records; and an email delivery provider for sign-in codes. These providers process data to provide services to Murmur.

## Retention

Murmur does not retain captured audio or full transcript history by default. With your consent, it retains the derived session insight for up to 24 months from creation, then deletes it. Account records remain until you delete your account. Entitlement, store transaction, usage, renewal, and refund records may be retained as needed for service integrity, fraud prevention, financial reconciliation, and legal obligations; direct identifiers are removed when the account is deleted where possible. Analytics, diagnostics, campaign, session, and rate-limit metadata is retained only as needed for measurement, abuse prevention, debugging, and service operation, under applicable provider retention settings.

## Your Choices

- Stop or cancel a live session at any time.
- Decline AI session insights or turn them off in Settings to stop future insight processing.
- Turn Anonymous Analytics off in Settings to stop new analytics events, install-attribution reporting, and session replay. Essential sanitized crash and error monitoring can continue.
- Reset Murmur Identity or use Delete Local Data in the app.
- Delete your Murmur account and sign-in data in Account & billing. Store subscriptions must be cancelled separately.
- Contact support to request deletion of server-side insights, diagnostics, or report records that can be identified from the information you provide.

## Children

Murmur is not designed for children and is not intended for the Kids Category or Designed for Families.

## Contact

Murmur is operated by Q9 Labs. Email `q9labs.ai@gmail.com` for privacy, deletion, or support requests. Public privacy URL: `https://murmur.q9labs.ai/privacy`.
