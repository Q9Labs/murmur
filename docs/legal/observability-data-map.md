# Murmur Observability Data Map

Last updated: 2026-08-29

Murmur uses PostHog US for anonymous product analytics and Sentry for sanitized crash, error, performance, and release diagnostics. Mobile product analytics always pass through Murmur's Cloudflare Worker. The Worker rejects unknown event names, drops properties outside the fixed schema, and rejects unbounded values and malformed types before forwarding an event.

## Data Flow

```text
Murmur mobile
  -> Cloudflare Worker schema validation
  -> Worker hashes the connecting network address for a one-hour abuse limit
  -> Worker hashes the anonymous install id
  -> PostHog US receives only allowlisted event properties

Murmur mobile and Worker
  -> Sentry sanitizers remove user, content, request, and breadcrumb fields
  -> separate Murmur mobile and Worker Sentry projects
```

## PostHog Event Groups

- Activation uses app open, onboarding completion, Listen tap, session creation, live connection, first committed translation, and session completion events. A user activates when the first committed translation occurs.
- Translation quality uses completion outcome, whether a committed translation occurred, source and translated character counts, input audio counts, error category, and user-selected translation report category. These are proxy measures, not inspection or scoring of conversation text.
- Latency uses mobile startup and first-translation timing plus Worker provider-connection and first-source or first-translation timing.
- Retention uses a successful session with a committed translation as the return event for D1, D7, and D30 analysis.
- Failures use bounded stage and error codes, component, app release, environment, language pair, broad network type, and session outcome.

Every PostHog event includes `product=murmur`, `component=mobile|worker`, `environment`, and `telemetry_schema_version=1`. The PostHog distinct ID is a one-way Worker hash. Murmur sends `$geoip_disable=true`, `$ip=null`, and `$process_person_profile=false` with every capture.

The Worker uses a separate one-way hash of the connecting network address to limit analytics ingestion to 120 events per hour per network client. It keeps only request timestamps under that hash for up to one hour. It does not send the address or this abuse-prevention hash to PostHog or Sentry.

## Sentry Data Controls

- Mobile disables screenshots, view hierarchy capture, replay, request-failure capture, profiles, breadcrumbs, default PII, and user or extra contexts.
- Worker disables cookies, request and response bodies, query strings, user information, GraphQL documents and variables, database query data, generative-AI inputs and outputs, and stack-frame variables. It allowlists only the Cloudflare Ray header and strips URL query strings.
- Sentry tags contain bounded operational categories such as component, operation, stage, error code, environment, release, and the per-session application ID. They do not contain source or translated text.
- Production performance traces are sampled at 10 percent. Development performance traces are disabled.

## Prohibited Data

PostHog and Sentry must never receive raw or encoded microphone audio, source captions, translated captions, generated speech audio, free-form report text, provider prompts or responses, network names, precise location, contacts, advertising identifiers, authentication credentials, or raw anonymous install IDs.

Adding an event or property requires updating the protocol parser, its tests, this data map, the public privacy policy, store privacy disclosures when applicable, and the provider dashboard filters. Free-form metadata maps are not allowed.

## User Controls And Deletion

Anonymous Analytics is on by default and can be turned off in Settings. Turning it off stops new PostHog events from both mobile and Worker because the preference is included when the mobile app creates a live session. Essential sanitized crash and error monitoring can continue. Reset Murmur Identity changes the pseudonymous analytics identity. Delete Local Data resets the analytics preference and local identity. Support can process deletion requests using a report receipt or anonymous install/session metadata when available.
