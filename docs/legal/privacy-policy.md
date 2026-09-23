# Murmur Privacy Policy

Last updated: 2026-09-23

Murmur is a one-way live speech translator operated by Q9 Labs. You choose languages and an available audio source, tap Listen, and Murmur shows translated captions. Microphone mode can also play translated speech.

## Live Translation

Before a live session starts, Murmur asks you to allow the selected live audio to be sent through Murmur's Cloudflare Worker to OpenAI Realtime for speech recognition and translation. In Microphone mode, Murmur captures microphone audio only while a session you started is active. On supported Android devices, Phone audio mode captures eligible media playback after you approve Android's audio-recording and screen-sharing prompts; it does not capture the microphone in that mode.

OpenAI Realtime returns source and translated captions through Murmur's Worker. Captions are displayed on your device. Murmur does not save captured audio or keep cloud transcript history by default. Translated speech, when available, is returned for local playback.

On Android, floating captions can appear in a system overlay after you allow Murmur to display over other apps. The overlay is rendered locally and does not create another server copy of the captions.

## Local Translation History

For eligible paid users, Murmur saves committed translated captions in the app's Documents directory on the device only. Murmur does not upload this history to the cloud. Deleting your Murmur account does not erase on-device history. You can delete an individual history entry, use Delete Local Data to clear the history directory, or uninstall the app to remove its on-device data.

## Optional AI Session Insights

After your first completed session, Murmur asks whether you want AI session insights. This is a separate, optional choice from live translation and Anonymous Analytics. You can decline and continue using translation, or change your choice in Settings. The choice starts off.

Only a session with AI session insights consent can have translated text collected for insight processing. For a consented session with at least 30 seconds of translation, Murmur's Worker holds that text in memory during the session and sends it to OpenRouter at the end to derive a short record. The record may include the kind of setting, an event name if spoken, the topic, domain terms, an estimated speaker count, apparent user intent, a translation-quality score, possible confusing words or phrases, general sentiment, a short summary, and brief product feedback signals. Murmur discards the translated text after processing; it is not written to Murmur storage or logs.

Murmur stores the derived insight, not the transcript. The record is associated with a hashed install identifier, app session identifier, language pair, session duration, and creation time. A daily job deletes each insight after 24 months; deleting the associated Murmur account removes its insights sooner. Turning off AI session insights stops collection for future sessions but does not delete insights already stored. Avoid speaking sensitive or identifying information if you do not want it reflected in a derived insight.

## Accounts, Sign-In, and Purchases

Murmur creates a random guest customer identifier so it can provide Free time, track usage, and manage purchases. You can purchase, restore, and reconcile a purchase as a guest; an email or registered account is not required. If you choose to save a guest purchase to an account, Murmur links the guest's purchase and remaining balance to that account so you can recover them on another device.

You may save a purchase by signing in with Apple, Google, or email. For Apple sign-in, Murmur receives your email address and, if you share it with Apple on first sign-in, your name. Murmur stores your email address, the name you share, and Apple's stable account identifier with your account until you delete the account. For Google sign-in, Murmur receives your email address and, when Google provides them, your name and profile image. Murmur stores the received profile information and Google's stable account identifier with your account until you delete the account. Email sign-in uses your email address to deliver a one-time code. Murmur does not receive your Apple or Google password.

Murmur stores plan state, credit grants, usage debits, renewal, restore and refund records, and store transaction identifiers in an entitlement ledger. RevenueCat and the applicable app store help validate and manage purchases. Murmur does not receive or store payment-card details.

## Install, Session, and Connection Data

The app stores an anonymous install identifier and a separate Free-allowance identifier in platform secure storage. Murmur's server hashes these identifiers for diagnostics, pseudonymous measurement, and abuse prevention. Reset Murmur Identity replaces the diagnostic install identifier. Delete Local Data removes local identifiers; a hashed current-month Free claim may remain on the server through that allowance period to prevent duplicate grants.

Murmur may process short, allowlisted source, medium, campaign, content, partner, or landing-page labels from tagged links. On Android, Murmur may use the Play Install Referrer and Play Integrity. On iOS, Murmur may send an AdServices attribution token to Murmur's Worker, which resolves it with Apple. Murmur uses normalized source or campaign information to measure which campaigns lead to installs and use; it does not use it to track you across other companies' apps or websites. Turning Anonymous Analytics off stops forwarding new install-attribution information to product analytics.

Murmur may include the country derived from your network connection with relayed analytics events. It uses country only, not city or region, and does not collect precise location. Better Auth session records store the connection IP address and user-agent string until the session expires or the account is deleted. Separately, the Worker hashes the connecting network address for analytics rate limiting and keeps request timestamps under that hash for up to one hour; it does not send that address or rate-limit hash to PostHog or Sentry through the analytics relay.

## Analytics, Session Replay, and Diagnostics

Anonymous Analytics is on by default and can be turned off in Settings. Product analytics events pass through Murmur's Worker relay, which validates event names and properties before forwarding them to PostHog. Events may describe app and build version, platform, language pair, onboarding steps, plan and offer interactions, sign-in method, session outcome, background use, capture source, broad network type, timing, duration, bounded error categories, and install source. The relay does not include your email address, provider account identifier, or credentials.

Session replay uses the PostHog SDK directly from the device, not Murmur's Worker relay. PostHog therefore sees the device IP address on replay network traffic. Replays do not include microphone audio; live and saved translation text, email addresses shown on screen, text inputs, and images are masked, while buttons and other interface labels remain visible. When Anonymous Analytics is turned off, the app stops session recording and opts the replay client out. Essential sanitized crash and error monitoring can continue.

Murmur also sends sanitized crash, error, and sampled performance diagnostics to Sentry, such as a stack trace, bounded operation or error category, app release, environment, app session identifier, and limited timing data. Diagnostics do not include conversation content, request bodies, cookies, query strings, or user fields.

## Ratings, Survey Answers, and Translation Reports

After qualifying sessions, Murmur may ask for a five-star in-app rating and the optional question “What did you use Murmur for?” Answers use a short list of use-case categories, with an optional “Other” text response. When you submit the survey, its stars, use-case answer, and optional “Other” text go directly to Murmur's server, not to product analytics, and are stored for 24 months. You choose whether to submit; this direct submission is sent even when Anonymous Analytics is off. Account deletion removes ratings linked to that account. Anonymous ratings cannot be found by account deletion.

Murmur stores a qualified-session count and the version and time of its last native rating request on your device so it can time prompts and avoid asking repeatedly. This local state contains no audio or caption text. Native store-review prompts are separate from the in-app rating survey.

You can report an inaccurate, wrong-language, harmful, speech-related, or other translation issue. A report includes session and translation-span metadata. It may include text snapshots only when the app explicitly sends them. Reports are not removed by account deletion; contact support with the report receipt to request deletion. If a report webhook is configured, the report may also be sent to that webhook.

## Third-Party Service Providers

Murmur sends data to these service providers to operate the app:

- **Cloudflare** hosts Murmur's Worker, database, rate limiting, and related infrastructure.
- **OpenAI** receives selected live audio through Murmur's Worker for speech recognition, translation, and translated speech.
- **OpenRouter** receives translated text from consented sessions to create Session Insights.
- **PostHog** receives relayed product analytics and direct session-replay traffic.
- **Sentry** receives sanitized crash, error, and performance diagnostics.
- **RevenueCat** processes subscription and purchase lifecycle information.
- **Apple and Google** provide sign-in and app-store purchase services. Apple also receives iOS AdServices attribution requests; Google services provide Android Play Install Referrer and Play Integrity flows. The sign-in profile information Murmur stores with your account is described above and is removed when you delete the account.
- **Resend** delivers email sign-in codes.
- **A report webhook operator**, if Murmur's report webhook is configured, may receive submitted report data.

Under their terms, the AI service providers do not use request content to train their models, but may retain it for a limited period, typically up to 30 days, to monitor for abuse before deleting it.

## Retention and Deletion

Murmur does not retain captured audio or cloud transcript history by default. Eligible paid users' translated-caption history is stored only on their device, as described above. Session Insights are deleted by a daily job after 24 months or earlier when the associated account is deleted. Survey responses are retained for 24 months; account deletion removes account-linked responses but does not locate anonymous submissions.

Deleting your Murmur account removes the account and authentication records, associated Session Insights, and ratings linked to the account. It does not cancel an Apple or Google subscription or erase local translation history. Some deleted-state purchase, entitlement, usage, refund, or reconciliation records may remain in Murmur's billing ledger. Reports are deleted by support on request, not automatically by account deletion. PostHog and Sentry data expire under those providers' retention settings; Murmur does not automatically erase individual records from those services when an account is deleted.

Better Auth session IP and user-agent data remain until that session expires or the account is deleted. The hashed analytics rate-limit address and its timestamps are kept for up to one hour. OpenAI and OpenRouter request-content retention is governed by their provider terms as described above.

## Your Choices

- Stop or cancel a live session at any time.
- Decline AI session insights or turn them off in Settings to stop collecting translated text for future insights. Existing insights remain until account deletion or the 24-month retention job.
- Turn Anonymous Analytics off in Settings to stop new relayed analytics events, install-attribution reporting, and session replay. Essential sanitized crash and error monitoring can continue.
- Delete individual history entries or use Delete Local Data to clear on-device history and local data. Reset Murmur Identity replaces the diagnostic install identifier only.
- Delete your Murmur account and sign-in data in Account & billing. Store subscriptions must be cancelled separately.
- Contact support with a report receipt to request deletion of a translation report.

## Children

Murmur is not designed for children and is not intended for the Kids Category or Designed for Families.

## Contact

Murmur is operated by Q9 Labs. Email q9labs.ai@gmail.com for privacy, deletion, or support requests. Public privacy URL: https://murmur.q9labs.ai/privacy.
