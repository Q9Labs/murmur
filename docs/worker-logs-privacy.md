# Workers Logs privacy contract

This change prepares production logging. It does not deploy production. The lead must complete independent review before a production deployment.

## Producers

Only `privacy.ts` retains a native console writer. `entrypoint.ts` installs the console boundary before dependency modules evaluate. All other console methods become no-ops, including debug, errors, assertions, tables and timers. The Sentry SDK initializes with `debug: false`, `enableLogs: false`, no tracing and the existing event sanitizer. Better Auth also disables its own logger. Its `onAPIError` hook reports internal failures through the existing classified reporter, producing one sanitized Sentry event and one outcome. Expected client errors do not enter that reporter.

| Producer | Retained values | Dropped values |
| --- | --- | --- |
| `writeOutcome`, HTTP boundary, flags and integrity fallback, mobile relay | Registry-owned message/class/operation/code; fixed severity; valid UTC time; bounded duration; random-format trace/span/event IDs; strict release/environment; boolean synthetic; iOS/Android enum. | Extra attributes, arbitrary messages, exception data, URLs and request/user fields. |
| `session_created` | Server UUID, salted install digest and integer timestamp. | Acquisition strings, languages and integrity/capture fields. Normalized campaign text is still user-controlled text. |
| `session_stop` | UUID and integer timestamp. | Arbitrary path segment or malformed identifier. |
| `translation_reported` | Session/report UUIDs, salted span digest, integer revision/time, report-category enum, boolean snapshot-present flag. | Raw span, user note, snapshots, provider metadata and unregistered fields. |
| `translation_report_forward_failed` | UUIDs, timestamp and `unconfigured`, `webhook_network_error` or HTTP-status enum. | Remote response, webhook URL and arbitrary reason text. |
| Reconciliation, abandoned sessions, insight/rating retention and expired auth sessions | Registered event name and bounded non-negative integer counts. | Other fields and raw failures. |
| Better Auth core/plugins, Better Call router and Expo auth adapter | No console arguments. | Formatted emails, tokens, callback URLs, DB/provider exceptions and warnings. |
| Sentry SDK/core/instrumentation/transport | No console arguments or SDK log export. Existing exception export remains sanitized independently. | Debug/internal SDK output and arbitrary console arguments. |
| JOSE, integrity-attestation library, Better Auth utilities and transitive dependencies | No direct console output reaches the sink. | Any present or future console call. The boundary does not depend on each package honoring a debug flag. |
| Durable Object fetch/alarm and scheduled promise rejections | Fixed failure message and code-only stack location if Cloudflare records the exception. | Original thrown message/cause and arbitrary fields. |
| Cloudflare runtime | Platform-generated bounded errors, such as `Network connection lost.`, and metadata described below. | Application values do not enter uncaught exceptions at the owned boundaries. |

The legacy event registry rejects unknown event names and reconstructs allowed fields. Values do not pass because their key looks harmless. UUID/digest formats are field-specific. Unknown keys never pass recursively. Failed writes return `false` without retries or secondary reporting.

Translation span hashing accepts timestamp segments of 1–11 base-36 characters and random suffixes of 0–8 characters. `Math.random().toString(36).slice(2, 10)` can produce a one-character or empty suffix. The raw span never reaches the sink, including format-valid words.

## Cloudflare metadata

Both production and sandbox use:

```toml
[env.production.observability]
redact_query_string = true

[env.production.observability.logs]
enabled = true
persist = true
head_sampling_rate = 1
invocation_logs = false

[env.production.observability.traces]
enabled = false
```

Wrangler 4.147.0 is pinned because the earlier 4.92.0 schema did not support query-string redaction. Only its toolchain and the Sentry Wrangler peer resolution changed in the lockfile.

Turning invocation logs off does **not** remove all metadata from custom records. Complete retained sandbox records contain:

- `$workers.event.request`: method, URL and path; no query string, headers, cookies or body.
- `$workers`: script name/version, event type, execution model and truncation flag.
- `$metadata`: event/request/ray/trace/span IDs, trigger, service/account, timestamp, type, origin and event size.
- No response headers, response body or user enrichment in these custom records.

A request-scoped logging guard therefore permits only fixed known hosts, standard methods, exact route paths and UUID-format dynamic report/session paths. Unknown auth paths, arbitrary session-stop segments and unrecognized paths produce no custom records. Normal routing and responses are unchanged. Query values are removed by Cloudflare, not by changing the application's request.

Invocation records remain disabled because their richer request/response metadata is not part of this contract. Native platform errors still exist; the complete-record proof includes one WebSocket network error. Owned Durable Object callbacks catch failures before they reject to workerd, including state loading, state writes and customer binding. An outer promise catch is too late. Scheduled rejection boundaries also replace raw messages.

## Deployed proof

[Receipt](evidence/worker-logs-20261017/receipt.json), [request matrix](evidence/worker-logs-20261017/requests.json), [complete retained records](evidence/worker-logs-20261017/retained-records.json).

The verifier sends unique text, email and token sentinels in bodies, query values, authorization, cookies, custom headers, user-agent and referrer. It covers every top-level Worker route, malformed dynamic paths, session creation, stop, report, a real anonymous sign-in, email-OTP sign-in rejection, rejected and accepted authenticated relay batches, a WebSocket handshake and an authenticated synthetic error.

The retained query covers the sandbox deployment version and the test window, not just outcome fields. It rejects truncated/limited results, scans the entire JSON records, and requires the current run's session/report IDs and relay/error trace IDs. A replay of unrelated positive events fails. The scan includes records without a diagnostic code, including a platform network error and the diagnostic probe's extra stop.

The passing run has 34 probes and seven complete retained records. No sentinel, real fixture credential, session token or cookie appears anywhere in those records. The report retains a 64-character digest for a short span. No query, auth header, email, cookie, request body or response body appears in platform metadata. This proves this deployed corpus, not all future traffic or Sentry server ingestion.

The old sandbox lacks newer billing/insight tables. A temporary sandbox-only billing-enforcement override reaches session/report paths without migrations. Auth remains real for relay verification. The account-delete hook fails on the missing schema; the verifier removes only its own synthetic auth rows through the sandbox D1 API. Synthetic report receipts remain under the sandbox's existing report retention; no production data changes. Live Google/Apple provider login and a successful translation are outside this logging proof.

The owner-loss watchdog restores sandbox version `2ca27398-d8d2-432e-9a4e-17cd99edd209` and the exact prior non-versioned observability settings. The deployment API confirms the restored version at 100%. No migration, production deployment or mobile change is part of this phase.

## Retention, volume and cost

On 17 October 2026, Helium's account Workers Plans page showed **Paid**, $5/month plus usage, as the current plan. The subscription API returned 403. The usage panel showed about 625,200 account-wide observability events in the current billing period, below the included allowance.

Through November 2026, [Workers Logs pricing](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) includes 20 million events/month on Paid and charges $0.60 per extra million. Logs expire after seven days; this plan retention is not a per-Worker Wrangler setting. Maximum log size is 256 KB. The account limit is five billion logs/day, after which Cloudflare applies 1% sampling for the rest of the day. Full sampling here cannot override platform limits.

At roughly 1,000 requests/day, budget one event per request: about 1,006 events/day or 30,180/month, including up to six daily cleanup summaries. An eight-event relay-batch planning case is about 8,006/day or 240,180/month. These are mix assumptions, not measured production counts or hard caps on runtime failures. Healthy routes can emit no log; a report can emit two.

Incremental logging cost is **$0/month while the shared allowance remains available**. If other Workers exhaust it, those estimates add about $0.018–$0.144/month. The existing $5 plan fee does not change. The sandbox records' stored event sizes are 864–1,243 bytes; a conservative 1.5 KB/event estimate gives about 0.045–0.36 GB/month before compression.

From 1 December 2026, [Observability pricing](https://developers.cloudflare.com/observability/pricing/) changes to account-wide allowances of 50 GB ingested and 12 GB-month stored per billing cycle on Paid. Overage is $0.25/GB ingestion and $0.10/GB-month storage. Default retention remains seven days. The planning cases stay within those allowances in isolation; recheck shared account usage before deployment.

## Separate production phase

Do not run these commands until the lead has completed independent review and explicitly authorized production deployment. Confirm the approved commit, current production version and account usage first. The observed production version was `a661d412-8bec-4c3a-9b96-8c1bdb6ac146`; update the rollback target if someone deploys before this phase.

Deploy the reviewed checkout directly, without the release helper's automatic D1 migrations or any sandbox-only overrides:

```sh
cd /Users/macmini/code/murmur/.worktrees/prod-logs
source_sha="$(git rev-parse HEAD)"
release="murmur-worker@1.3.0+$source_sha"
2password run --env 'CLOUDFLARE_API_TOKEN=op://dev/Oort Workers Cloudflare/credential' -- pnpm --filter @murmur/worker exec wrangler deploy --env production --keep-vars --var "SENTRY_RELEASE:$release" --tag "$source_sha"
```

Observability settings are not versioned. A version rollback alone does not disable logging. Use the single fail-closed rollback script. It disables logs and traces, reads the settings back, and only then changes the version. The canonical script-settings read-back must show explicit null (fully disabled) or explicit disabled log/trace fields; a missing field fails closed. Any failed API step or mismatched read-back stops the script with a clear error. Do not replace this with independent commands:

```sh
cd /Users/macmini/code/murmur/.worktrees/prod-logs
2password run --env 'CLOUDFLARE_API_TOKEN=op://dev/Oort Workers Cloudflare/credential' -- pnpm rollback:worker-logs --env production --version a661d412-8bec-4c3a-9b96-8c1bdb6ac146
```

After deployment or rollback, read the active version and non-versioned settings back from Cloudflare and check complete retained records. A rollback cannot recall records already retained; they expire after seven days. The sandbox restoration exercised the same settings-disable, version-restore and settings-read-back sequence, not a production rollback.

## Review follow-up verification

The separate `apps/worker/privacy-probe.ts` entry point imports the real production entry point and Durable Object classes. It is not reachable from the production Wrangler configuration. Its sandbox-only storage wrappers inject private-email failures at limiter state reads/writes, native alarm reads/writes, customer binding reads/writes and ledger execution. Native callback exception records must contain only fixed failure messages. The verifier retrieves every matching retained record, requires each native positive control, and scans the complete JSON, not just outcomes.

A real Better Auth database failure runs through its own error handler and the production Sentry SDK. A temporary sandbox-only collector captures the actual outbound envelope. The probe entry point overrides the DSN only for its invocation, leaving the real secret binding unchanged. Its deployment alone enables `global_fetch_strictly_public` for the collector loopback. The verifier requires exactly one envelope and one retained outcome with the same current-run trace, and checks both for the email. This proves the SDK export, not ingestion by Sentry's hosted service. The broad route proof also checks the account-delete failure.

Before deployment, require a clean checkout and record the complete source SHA. Deploy the production entry point and the separate probe entry point from that same SHA with the full SHA as both the version tag and Sentry release suffix. Read both deployed version tags and release bindings back from Cloudflare. Attach the receipts and complete records to PR #103 without changing the deployed source commit afterwards.

The rollback proof first forces a real Cloudflare PATCH denial on the sandbox and verifies that no later API call runs and that its active version/settings do not change. It then runs the normal script, verifies logs/traces are off before the version POST, checks the restored version, and restores the exact prior sandbox settings. The owner-loss watchdog uses the same fail-closed rollback.
