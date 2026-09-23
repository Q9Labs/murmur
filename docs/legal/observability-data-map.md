# Murmur Observability Data Map

Last updated: 2026-09-23

This internal map describes the 1.3.0 analytics, diagnostics, session-insight, survey, and report flows. Mobile product analytics pass through Murmur's Worker relay, which rejects unknown event names, drops properties outside the fixed schema, and rejects unbounded values and malformed types before forwarding events to PostHog US. The PostHog session-replay SDK connects directly from the device to PostHog and bypasses that relay. Sentry receives sanitized crash, error, and sampled performance diagnostics.

## Data Flow

```text
Live audio selected by the user
  -> Murmur Cloudflare Worker
  -> OpenAI Realtime for speech recognition, translation, and translated speech
  -> Worker returns captions/audio to the device

Murmur mobile
  -> Worker schema validation for product analytics
  -> Worker adds country code only (no city or region)
  -> Worker hashes install id for analytics identity and suppresses source IP
  -> PostHog US receives allowlisted events

Murmur mobile
  -> PostHog session-replay SDK connects directly to PostHog, not through the Worker
  -> PostHog receives replay traffic with the device IP visible to the provider
  -> all text, text inputs, and images are masked; replay stops when analytics is off

Murmur mobile and Worker
  -> Sentry sanitizers remove user, content, request, and breadcrumb fields
  -> separate Murmur mobile and Worker Sentry projects

Consented translation session
  -> Worker collects translated text in memory only for a session with insight consent
  -> OpenRouter derives a bounded insight at session end
  -> D1 stores the insight JSON with hashed install id, app session id,
     language pair, duration, and creation time; translated text is discarded

User-submitted rating survey
  -> app sends stars, use-case answer, and optional Other text directly to Murmur's Worker
  -> D1 stores the response for 24 months, independently of analytics consent
  -> no survey response is sent to product analytics

User-submitted translation report
  -> Murmur's Worker stores the report
  -> configured REPORT_WEBHOOK_URL may receive the submitted report
```

## Recipients

- **Cloudflare:** Worker hosting, D1, Durable Objects, rate limiting, and related infrastructure.
- **OpenAI:** selected live audio and associated live translation requests.
- **OpenRouter:** translated text from consented sessions for Session Insights.
- **PostHog:** allowlisted product events through the Worker relay and direct session-replay traffic.
- **Sentry:** sanitized mobile and Worker crash, error, and performance diagnostics.
- **RevenueCat:** subscription and purchase lifecycle information.
- **Apple and Google:** sign-in and app-store purchase services; Apple AdServices attribution resolution on iOS; Play Install Referrer and Play Integrity services on Android. Apple provides the email address and any name shared on first sign-in; Google provides the email address and, when available, name and profile image. Murmur stores the received profile information with the account until account deletion.
- **Resend:** email sign-in code delivery.
- **The operator of REPORT_WEBHOOK_URL, when configured:** user-submitted translation reports.

AI providers do not use request content to train their models under their terms, but may retain request content for a limited period, typically up to 30 days, for abuse monitoring before deleting it.

## PostHog Event Groups

- Onboarding: step viewed and completed, with bounded step names.
- Paywall and purchases: funnel events, plan-tab views, offer shown or redeemed, and bounded plan or outcome values. Purchase and entitlement ledger details stay in the billing system and are not copied into product events unless explicitly allowlisted.
- Sign-in: account saved and selected method; no email, provider account id, or credential is included in the event.
- Ratings: submitted survey answers (stars, use case, and optional Other text) are sent to Murmur's server and are not product analytics. Native store-review prompts are separate.
- Sessions: creation and outcome, language pair, background-session flag, capture source, broad network type, timings, duration, audio byte/frame counts, caption character counts, error category, and whether translation was committed.
- Install attribution: Android Play Install Referrer on first launch and iOS AdServices attribution token resolved with Apple. Only normalized source/campaign values are added to analytics; no audio or caption text is used for attribution.
- Country: Cloudflare's connection country only; no city, region, or precise location.
- Session insights: when analytics is on, a separate event may contain enum and numeric fields such as setting, speaker estimate, translation quality, sentiment, duration, and language pair. It does not contain transcript, topic, event name, summary, confusion phrase, intent, or free text.
- Session replay: app screens and interactions are sent directly from the app to PostHog, not relayed by the Worker. All text, text inputs, and images are masked. The replay SDK sees the device IP at the network layer, and recording stops when Anonymous Analytics is off.

Every relayed PostHog event includes product, component, environment, and telemetry schema version. The PostHog distinct ID is a one-way Worker hash of the anonymous install id. The Worker disables provider-side IP geolocation and person profiles for relayed events. This suppression does not apply to direct session-replay traffic.

The Worker separately hashes a connecting network address to limit analytics ingestion to 120 events per hour per network client. It keeps request timestamps under that hash for up to one hour and does not include the raw address or hash in the relayed PostHog event.

## AI Session Insights

- Insight processing requires the user's separate insights-consent choice. The setting starts false, is requested after the first completed session, and can be changed in Settings.
- Only translated text from sessions with insight consent is collected for insight processing. Sessions need at least 30 seconds of translation. The Worker holds translated text in memory during the session and sends it to OpenRouter at session end to derive a structured result: setting, optional event name, topic, domain terms, estimated speaker count, user intent, translation-quality score, possible confusions, sentiment, short summary, and product signals.
- The Worker stores the JSON result in session_insights with hashed install id, app session id, language pair, duration, and created_at, then discards the translated text. The text is not written to Murmur storage or logs.
- A daily job deletes stored insights after 24 months. Account deletion removes the account's insights sooner. Turning off insight consent stops collection for future sessions but does not delete existing insights.
- A separate session_insight PostHog event may contain enum and numeric fields only, and only when Anonymous Analytics is on.

## Ratings and Reports

- A user who chooses to submit a rating sends stars, the use-case choice, and optional Other text directly to Murmur's Worker. This direct survey submission is not product analytics and is sent regardless of the Anonymous Analytics setting.
- Murmur stores rating responses for 24 months. Account deletion removes account-linked ratings. Anonymous ratings have no account link and are not found by account deletion.
- A translation report may include session/span metadata and text snapshots only when the app explicitly submits them. Reports are not removed by account deletion; support deletes them on request using the report receipt. If REPORT_WEBHOOK_URL is configured, report data is also sent to that endpoint.

## Session, Local History, and Retention

- Better Auth's session table stores IP address and user agent until the session expires or the account is deleted. This is separate from the hashed network address used for short-lived rate limiting.
- Eligible paid users' committed translated captions are saved under the app's local Documents directory only; they are not uploaded as cloud history. Account deletion does not remove local history. Individual history deletion and Delete Local Data remove saved entries; uninstalling the app removes its device-only data.
- Session Insights expire after 24 months by a daily deletion job or earlier on account deletion. Rating responses expire after 24 months. AI-provider request content may be retained under provider terms for a limited period, typically up to 30 days, for abuse monitoring.
- PostHog and Sentry data expire under those providers' retention settings. Murmur has no automated account-deletion erasure integration for those provider records.

## Sentry Data Controls

- Mobile disables screenshots, view hierarchy capture, Sentry replay, request-failure capture, profiles, breadcrumbs, default PII, and user or extra contexts. Product session replay is handled separately by PostHog with text, input, and image masking.
- Worker disables cookies, request and response bodies, query strings, user information, GraphQL documents and variables, database query data, generative-AI inputs and outputs, and stack-frame variables. It allowlists only the Cloudflare Ray header and strips URL query strings.
- Sentry tags contain bounded operational categories such as component, operation, stage, error code, environment, release, and the per-session application ID. They do not contain source or translated text.
- Production performance traces are sampled at 10 percent. Development performance traces are disabled.

## Prohibited Data

PostHog and Sentry must not receive raw or encoded microphone audio, source captions, translated captions, generated speech audio, provider prompts or responses, network names, precise location, contacts, advertising identifiers, authentication credentials, raw anonymous install IDs, or free-form translation reports. Session-insight free text remains in the D1 insight record and is not part of PostHog events. Optional Other survey text is a separate, user-submitted field sent to Murmur's server and must not be sent to product analytics.

Adding an event or property requires updating the protocol parser, its tests, this data map, the public privacy policy, store privacy disclosures when applicable, and provider dashboard filters. Free-form event metadata maps are not allowed.

## User Controls and Deletion

Anonymous Analytics is on by default. Turning it off stops new relayed PostHog product events and install-attribution forwarding; the mobile replay code stops session recording and opts the client out. Essential sanitized crash and error monitoring can continue. AI session insights have a separate consent control; turning it off stops collection for future sessions but does not delete stored insight records.

Account deletion removes the account, its insights, and account-linked ratings. It does not clear device-only translation history, delete a report, or automatically erase PostHog and Sentry data. Reports can be deleted by support on request; PostHog and Sentry records expire under provider retention settings. Anonymous rating responses cannot be located through account deletion.
