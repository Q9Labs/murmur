# Worker diagnostics pilot

The Worker separates handled outcomes from actionable defects. Version 1 of the local registry is in `packages/protocol/src/diagnostics/failures.ts`. Each entry owns its class, operation, safe description, retry policy and effect on the main action. Unknown failures remain visible; HTTP status alone does not establish meaning.

## Ownership and privacy

The HTTP boundary catches uncaught failures, records one terminal outcome and returns a safe diagnostic code. It does not rethrow to automatic capture. Recovered optional integrity and flags operations own their own degraded outcomes; their causes are not propagated for a second capture. Other existing realtime and background capture sites are not migrated in this PR.

Only defects and unknowns go to Sentry. Expected and dependency outcomes go to logs. Known flags timeouts keep defaults and do not send exceptions; invalid requests and deployment credentials remain defects. Optional integrity keeps its existing success fallback. Malformed Google success payloads are verifier defects, not token rejections; optional verification still falls back. Sentry tracing is disabled in all environments. Export failures never report themselves through Sentry.

Sentry payloads are reconstructed, not spread: registry messages, bounded code locations, safe release, classification and correlation only. Request/user/context/breadcrumb data, arbitrary exception types and chains' messages, locals, source context and provider bodies are dropped. JS source-map debug identifiers and matching scrubbed code-file locations remain allowed. This changes the shared Worker sanitizer, including remaining capture sites; those receive the unknown fallback until their migration.

## Outcome logs

The sink emits one JSON line per outcome using q9stack's existing OTel log conventions: `_time`, `trace_id`, `span_id`, `body`, `severity_text`, `service.name`, `service.version`, `deployment.environment`, and bounded `attributes` (`action`, `reason`, `error_code`, `outcome`, `duration_ms`, `retryable`, optional `source_surface`). Optional `sentry_event_id` joins the two destinations. `synthetic` identifies the sandbox proof. These are log records, not a replacement version of DiagnosticEvent. No flow coverage or complete q9 CLI classification support is claimed by this PR.

The diagnostic code is a random W3C trace ID. Valid `traceparent` continues correlation; invalid input is replaced rather than reflected. Non-upgrade HTTP responses expose `X-Diagnostic-Code` through CORS; unexpected failures also return `diagnostic_code` in the JSON response. WebSocket lifecycle reporting is deferred.

Sandbox enables retained Workers Logs at sampling 1 and disables invocation logs and traces. **Production Workers Logs remain disabled.** Disabling invocation logs alone does not suppress custom console output. All Worker-owned console producers already use `logWorkerEvent`; its boundary now replaces invalid ID-shaped values with `[redacted]` (UUID or fixed-length hex, with exact trace/span/hash lengths; translation spans use a separate, salted 64-digit hex `translation_span_id`). The privacy corpus includes the actual exported session-stop handler, the report parser/logger, and every existing producer shape. Other legacy fields do not yet have a complete value allowlist, so this PR does not authorize their production retention.

Cloudflare's published limits at planning time were 3-day retention on Free and 7-day retention on Paid, with pricing changes announced for 1 December 2026. Actual account tier, shared usage and incremental cost must be checked before production rollout. This pilot does not provide Axiom's 30-day history or an independent missing-marker alert. See [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/). Do not infer zero incremental cost from full sampling.

## Mobile relay

`POST /v1/diagnostics` is independent of product analytics consent. It requires the existing Better Auth session and a configured salted address limiter; neither user identity, address nor hash is exported. The complete batch must validate before any write. Limits are 32 KiB/body, 8 events/batch, 2 KiB/event, a 2-second body-read deadline, and timestamps within 24 hours. Unknown keys are rejected. The relay currently accepts `mobile.operation_failed` with `failed`, iOS/Android origin, a safe mobile release, random trace/span IDs and bounded duration. PR 4 will grow typed mobile codes alongside their real capture sites, not before.

A relayed failure never requests a Worker Sentry capture. Mobile retains responsibility for its own Sentry event. A 202 acknowledges a sink write, not durable retention. Batches can be partially written if the sink fails; clients must use bounded best effort, not an unbounded retry loop. Pre-auth/offline/process-death loss and mobile queue policy are deferred to PR 4. The existing limiter storage is reused with a separate diagnostics key prefix, not the product-analytics allowance.

## Proof and undo

`pnpm run test:diagnostics` drives the actual SDK envelope transport and HTTP boundary, the real flags deadline, Android integrity fallback and relay/limiter. It writes synthetic envelope/outcome evidence to `artifacts/observability/sdk-proofs.json`. The canonical full gate remains `pnpm run gate` and runs on an isolated remote test host.

For live verification, deploy only sandbox without invoking the release helper (that helper runs remote D1 migrations). Record the previous sandbox version first. Use an ephemeral 64-hex-character `MURMUR_DIAGNOSTICS_FIXTURE` value in the sandbox deployment only. It enables an authenticated synthetic failure at `/__diagnostics/failure`; production refuses the fixture regardless of configuration. Supply the same fixture value, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and sandbox `MURMUR_DIAGNOSTICS_BASE_URL` in the environment to `node tooling/scripts/verify-diagnostic-delivery.mjs`. Never put credentials in a report. The script owns a filtered Workers tail, triggers the actual boundary, retrieves by diagnostic code within 120 seconds, validates the safe record and deletes its tail. It checks every custom log and exception in the streamed invocation, then allows one bounded minute for retained indexing. It retrieves the matching retained record and every record with its request ID, checks the full Cloudflare envelopes, rejects truncation, and saves only a reconstructed safe outcome, counts and proof markers. This proves streaming and retained delivery for the synthetic invocation, not Sentry server ingestion or source-map resolution.

Restore the recorded sandbox version after the proof so the fixture is disabled and the prior deployment/settings are back. For code undo, revert this PR and redeploy the previous Worker artifact through the separately approved release process. No database, billing state, mobile binary, symbol upload, production deployment or OTA is part of this PR. Disabling log export loses future outcomes; already-retained records expire under Cloudflare retention and cannot be recalled by a code revert.

Relay tests currently supply the authenticated session at the auth seam. They prove validation and limiting **after authentication**, not real Better Auth session creation or cookie verification. The current Vitest harness has no D1-backed auth fixture.

The relay accepts the existing mobile release format, `com.q9labsai.murmur@<version>+<numeric build>`. HTTP correlation accepts all two-digit lowercase hexadecimal trace flags without enabling Sentry tracing. SDK proof files are written only in explicit `pnpm run test:diagnostics` proof mode; ordinary unit and gate runs do not write them.

Client-generated translation spans are not trusted just because they match the protocol format. The report logger hashes well-shaped spans with `SESSION_HASH_SALT`; missing salt or failed hashing produces a marker without changing report acceptance. Raw protocol spans never pass the log boundary. Full Cloudflare records are checked only in memory and are not persisted by the live verifier.
