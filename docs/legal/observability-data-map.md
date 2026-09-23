# Murmur Observability Data Map

Last updated: 2026-09-23

This internal map describes the 1.3.0 analytics and diagnostics flows. Mobile product analytics pass through Murmur's Worker relay, which rejects unknown event names, drops properties outside the fixed schema, and rejects unbounded values and malformed types before forwarding them to PostHog US. Sentry receives sanitized crash, error, and sampled performance diagnostics.

## Data Flow

```text
Murmur mobile
  -> Worker schema validation
  -> Worker adds country code only (no city or region)
  -> Worker hashes install id for analytics identity
  -> PostHog US receives allowlisted events

Murmur mobile
  -> masked session replay through the replay-only SDK
  -> PostHog US receives app screens and interactions with all text inputs
     and translation/transcript text views masked

Murmur mobile and Worker
  -> Sentry sanitizers remove user, content, request, and breadcrumb fields
  -> separate Murmur mobile and Worker Sentry projects

Consented translation session
  -> transcript text held in Worker memory during the session
  -> third-party AI service provider derives a bounded insight at session end
  -> D1 stores the insight JSON with hashed install id, app session id,
     language pair, duration, and creation time; transcript is discarded
  -> PostHog receives enum and numeric insight fields only, never free text
```

## PostHog Event Groups

- Onboarding: step viewed and completed, with bounded step names.
- Paywall and purchases: existing funnel events, plan-tab views, offer shown/redeemed, and bounded plan or outcome values. Purchase and entitlement ledger details stay in the billing system and are not copied into product events unless explicitly allowlisted.
- Sign-in: account saved and the selected method; no email, provider account id, or credential is included in the event.
- Ratings and survey: five-star value, selected use-case answer, and the platform when a native store-review prompt is requested. If a user selects “Other” and writes an answer, that optional text may be included. The UI should tell users not to include sensitive or identifying details.
- Sessions: creation and outcome, language pair, background-session flag, capture source, broad network type, timings, duration, audio byte/frame counts, caption character counts, error category, and whether translation was committed.
- Install attribution: Android Play Install Referrer on first launch and iOS AdServices attribution token resolved by Apple's attribution service. Only normalized source/campaign attribution values are added to analytics; no audio or caption text is used for attribution.
- Country: Cloudflare's connection country only; no city, region, or precise location.
- Session insights: only enum and numeric fields such as setting, speaker estimate, translation quality, sentiment, duration, and language pair. No transcript, topic, event name, summary, confusion phrase, intent, or free-text product signal is sent to PostHog.
- Session replay: app screens and interactions with all text inputs and translation/transcript text views masked. It must respect Anonymous Analytics opt-out and must not duplicate the relayed mobile events.

Every relayed PostHog event includes `product=murmur`, `component=mobile|worker`, `environment`, and `telemetry_schema_version=1`. The PostHog distinct ID is a one-way Worker hash of the anonymous install id. The Worker disables provider-side IP geolocation and person profiles for relayed events.

The Worker uses a separate one-way hash of the connecting network address to limit analytics ingestion to 120 events per hour per network client. It keeps request timestamps under that hash for up to one hour. It does not send the address or abuse-prevention hash to PostHog or Sentry.

## AI Session Insights

- Insight processing requires the user's separate `insights_consent` choice. The setting starts false, is requested after the first completed session, and can be changed in Settings.
- Only sessions with at least 30 seconds of translation qualify. The Worker accumulates transcript text in memory during the session and sends it to a third-party AI service provider at session end to derive a structured result: setting, optional event name, topic, domain terms, estimated speaker count, user intent, translation-quality score, possible confusions, sentiment, short summary, and product signals.
- The Worker stores the JSON result in `session_insights` with hashed install id, app session id, language pair, duration, and `created_at`; it then discards the transcript. The transcript is never written to a store or log by Murmur.
- Proposed retention: delete the stored insight after 24 months. Founder approval and a matching deletion mechanism are required before this promise is published.
- A separate `session_insight` PostHog event may contain enum and numeric fields only. It must not contain free text.
- Turning off insight consent stops future insight generation. Turning off Anonymous Analytics stops new PostHog events and replay; these are separate settings. Implementation must ensure the insight event, install-attribution forwarding, and any replay stream all honor analytics opt-out.

## Sentry Data Controls

- Mobile disables screenshots, view hierarchy capture, Sentry replay, request-failure capture, profiles, breadcrumbs, default PII, and user or extra contexts. Product session replay is handled separately by PostHog with text masking.
- Worker disables cookies, request and response bodies, query strings, user information, GraphQL documents and variables, database query data, generative-AI inputs and outputs, and stack-frame variables. It allowlists only the Cloudflare Ray header and strips URL query strings.
- Sentry tags contain bounded operational categories such as component, operation, stage, error code, environment, release, and the per-session application ID. They do not contain source or translated text.
- Production performance traces are sampled at 10 percent. Development performance traces are disabled.

## Prohibited Data

PostHog and Sentry must never receive raw or encoded microphone audio, source captions, translated captions, generated speech audio, provider prompts or responses, network names, precise location, contacts, advertising identifiers, authentication credentials, raw anonymous install IDs, or free-form translation reports. Session-insight free text remains in the D1 insight record and is not part of PostHog events. The optional “Other” survey answer is a separate, user-submitted feedback field and must remain clearly optional.

Adding an event or property requires updating the protocol parser, its tests, this data map, the public privacy policy, store privacy disclosures when applicable, and provider dashboard filters. Free-form event metadata maps are not allowed.

## User Controls and Deletion

Anonymous Analytics is on by default. Turning it off stops new PostHog product events, install-attribution forwarding, and session replay. Essential sanitized crash and error monitoring can continue. AI session insights have a separate consent control; turning it off stops future insight processing but does not delete existing insight records. Reset Murmur Identity changes the pseudonymous analytics identity. Delete Local Data resets the analytics preference and local identity. Support can review deletion requests for records that can reasonably be identified from a report receipt or anonymous install/session details.
