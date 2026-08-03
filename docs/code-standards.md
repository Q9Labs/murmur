# TypeScript Code Standards

These standards define the code shape Murmur should preserve across the Expo mobile app, Cloudflare Worker, and shared protocol package. They favor explicit boundaries, predictable behavior, and code that is easy to verify in production.

## Core Principles

- Make data flow and ownership obvious from the file and module structure.
- Prefer the smallest design that serves a current consumer. Add abstraction after a second real use proves the seam.
- Model important states and boundaries in types, then validate untrusted values at runtime.
- Keep one vocabulary and one implementation for each concept.
- Treat accessibility, privacy, security, and operability as product behavior.
- A feature is complete when its production path is wired and verified, not when isolated code or tests exist.

## Naming and Vocabulary

- Use `camelCase` for values and functions, `PascalCase` for types and React components, and existing protocol casing for serialized fields.
- Types and interfaces are nouns. Functions and methods are verbs or verb phrases that describe the decision they make.
- Prefer domain names such as `TranslationSession`, `ProviderRoute`, and `InstallIdentity` over mechanical names such as `DataManager` or `SessionHandler`.
- Keep one term per concept. Do not alternate between words such as `diagnostics`, `telemetry`, and `observability` for the same data.
- Avoid vague verbs such as `process`, `handle`, and `normalize` when a precise action exists. Prefer names such as `parseSummaryRequest`, `redactWorkerEvent`, or `selectTranslationRoute`.
- Avoid new catch-all modules or directories named `utils`, `helpers`, `common`, `shared`, or `misc`. Put reusable code under the concept it represents. Existing broad modules should not attract unrelated work.
- Do not repeat context already carried by the module. Inside a translation module, prefer `validateRequest` over `validateTranslationRequest` when the shorter name remains unambiguous at call sites.
- Do not shadow platform globals or common imports such as `URL`, `Request`, `Response`, `crypto`, or `fetch`.

## Files and Modules

- Keep exported types, constants, and boundary contracts near the top of a file. Put implementation details below the public surface they support.
- Keep files focused on one concept. Split files approaching 300 lines unless cohesion or framework constraints make the larger shape clearer.
- Prefer direct imports from the owning module. Do not add forwarding files, compatibility aliases, or barrel exports without a stable public API need.
- Keep route entrypoints and composition roots thin. Expo Router files compose screens; the Worker entrypoint mounts routes and bindings. Neither should own substantial product logic.
- Keep dependencies directional. Mobile and Worker may depend on protocol; protocol must remain runtime-neutral; mobile and Worker must not import each other's source.
- Colocate focused tests with the behavior they verify. Keep generated files, assets, provider configuration, and release metadata in their canonical package locations.

## Types and Runtime Boundaries

- Use inferred types for clear local values and explicit types for exported APIs, state shapes, callbacks, environment bindings, and cross-module boundaries.
- Prefer discriminated unions and literal types over collections of loosely related booleans. Make invalid states difficult to represent.
- Avoid `any`. Receive untrusted data as `unknown`, validate it, and return a typed value.
- A type assertion must mark a boundary whose invariant is proven by validation, a platform contract, or a focused test. Do not use assertions to silence incomplete modeling.
- Preserve wire-format names at transport boundaries when compatibility requires them. Translate into domain-shaped names only when the translation has a clear owner and removes real ambiguity.
- Shared protocol types describe stable cross-runtime contracts. They do not replace Worker-side validation of requests, provider responses, WebSocket messages, or environment values.
- Keep provider SDK types, Cloudflare binding details, Expo native-module shapes, and platform-specific values inside their adapters.
- Represent absence honestly with `null` or an optional field according to the contract. Do not overload empty strings, zero, or sentinel objects to mean missing data.

## Control Flow and State

- Prefer early returns to deep nesting. Keep the successful path easy to scan.
- Use exhaustive checks for discriminated unions. A newly added state should produce a type error wherever behavior must be decided.
- Derive values during render or evaluation when they can be derived. Do not mirror derived values in mutable state.
- Put state transitions in the event or domain action that causes them. Avoid hidden coupling between unrelated callbacks, refs, and effects.
- In React, use effects only to synchronize with external systems such as subscriptions, timers, browser APIs, native modules, or network lifecycle. Do not use an effect for derivation or as a substitute for an event handler.
- Every effect that acquires a resource must release it. Async callbacks must guard against updates after cleanup when the API cannot be cancelled.
- Keep hooks focused. Extract domain operations and pure decisions before a hook becomes an application hidden inside one function.
- Use `void` on a promise only when the caller intentionally does not await it and failure is handled inside the operation. Important writes and lifecycle transitions should be awaited.

## Boundaries and Adapters

- Core behavior uses product-domain language. The OpenAI Realtime adapter owns credentials, URLs, request mapping, response parsing, and upstream error translation.
- Provider-specific IDs, headers, model quirks, SDK errors, and retry semantics must not leak into shared protocol contracts or unrelated UI state.
- Define a port from the consumer's current needs. Do not copy an entire vendor SDK surface into an interface.
- Keep transport work at the edge: parse requests, validate limits, authenticate or attest the caller, and translate errors before entering product logic.
- Keep product decisions out of transport and provider adapters. Adapters translate; product modules decide.
- Do not create layers solely to match an architectural diagram. A direct function call is preferable when no independent policy or replaceable boundary exists.
- Test product rules independently from provider mapping so failures identify whether the contract or adapter is wrong.

## One Concept, One Implementation

- A validation, parsing, redaction, routing, language, identity, or status rule has one canonical implementation.
- Search before adding a helper. A second local implementation of an existing rule is a defect even when it is only a few lines.
- Shared code must earn its location by preserving a real invariant or removing meaningful duplication. Visual similarity alone does not justify abstraction.
- Keep boundary-specific conversion with the boundary. A provider payload mapper belongs in that provider adapter until another consumer proves a broader home.
- Remove obsolete implementations when consumers move to the canonical path. Do not leave compatibility shims without a named external consumer and removal plan.

## Errors and Observability

- Give the same failure one stable name and meaning across the codebase.
- Translate provider and platform failures into Murmur error categories at the boundary. Do not expose credentials, raw provider payloads, internal stack traces, or account metadata to clients.
- Preserve the original cause for server-side diagnosis when it is safe. Return bounded, stable, user-appropriate error responses.
- Log structured events with explicit fields. Redact before logging and keep audio, transcripts, captions, tokens, secrets, and raw attestations out of logs.
- Expected failure paths should be observable without relying on user content. Include safe correlation identifiers, provider route, stage, latency, and result category where useful.
- Never swallow a failure merely to keep a flow moving. Recover deliberately, report a safe status, or fail the operation.

## Security and Request Hardening

- Defaults must be safe to ship. Production configuration either supplies valid secrets and secure endpoints or fails fast.
- Keep the OpenAI credential on the Worker. Mobile never receives it or any upstream connection credential.
- Treat every request body, query parameter, header, WebSocket message, provider response, environment value, and persisted preference as untrusted input.
- Bound request bodies, strings, collections, audio buffers, WebSocket queues, timeouts, retries, and provider output before expensive work.
- Apply authentication, device-integrity checks, authorization, and rate limits before the protected operation. An identifier supplied by a client is never proof of access.
- Keep health and readiness endpoints deliberately minimal. Debug, profiling, experimental routing, and diagnostic surfaces must remain unavailable or strictly gated in production.
- Escape or constrain caller-controlled values before placing them in URLs, paths, headers, logs, or provider requests.
- Enforce important invariants at more than one boundary when the extra check is inexpensive and protects against future refactors.

## Mobile and Accessibility

- Preserve accessible names, roles, states, focus behavior, reduced-motion behavior, readable contrast, and touch target sizes whenever UI is changed.
- Keep Expo Router files as route boundaries and place screen behavior under `apps/mobile/src`.
- Isolate native-module and browser differences behind typed platform adapters. Avoid platform checks scattered through product components.
- Do not persist audio or transcript history unless the product contract explicitly changes. Local deletion must clear every item described to the user.
- UI variants may change presentation. They must share the same privacy disclosure, language rules, session lifecycle, error semantics, and accessibility contract.

## Testing and Verification

- Test observable behavior and invariants rather than implementation details.
- Every bug fix adds a regression test at the narrowest level that reproduces the failure.
- Boundary tests cover valid input, malformed input, size limits, missing credentials, timeouts, and translated provider failures.
- Protected operations include tests for anonymous, unauthorized, rate-limited, and invalid-integrity cases when those states apply.
- Provider adapters test request mapping and response parsing with representative fixtures. Product tests should not require live provider calls.
- UI tests cover state decisions and critical interaction wiring. Pure decisions should be extracted and tested without a native renderer where practical.
- Never delete, skip, loosen, or exclude a failing test to make a change pass. Fix the behavior or report the blocker.
- Run `pnpm run gate` before committing, pushing, or opening a pull request. For runtime changes, also build or exercise the affected app through its real entrypoint.

## Shipping Foundations

- Do not merge tested but disconnected subsystems. Production code must have a real non-test consumer in the same change.
- Add only the states, routes, provider capabilities, and configuration required by a current product path.
- Keep deployment, secret rotation, store submission, and live smoke checks explicit. The local gate must remain non-mutating.
- New dependencies require a maintenance, recency, adoption, vulnerability, bundle-size, and platform-compatibility review.
- Generated output, caches, local logs, credentials, temporary artifacts, and native build products stay untracked.
- Preserve conventional commits, focused changes, release notes when behavior changes, and a clean public history.

## Comments

- Comment constraints, invariants, workarounds, privacy decisions, and non-obvious tradeoffs.
- Do not restate the code or narrate control flow.
- Treat a long explanatory comment as a design checkpoint. Improve the shape when naming, types, or boundaries can express the rule more clearly.
- Temporary workarounds need the external constraint and a concrete removal condition.

## Review Checklist

- Does the name communicate the domain decision or boundary?
- Is there one implementation of each rule?
- Are untrusted values bounded and validated before use?
- Are provider and platform details contained by their adapters?
- Is state derived where possible and synchronized explicitly where necessary?
- Are privacy, accessibility, security, and logging behavior preserved?
- Is the feature wired through a real entrypoint and covered by focused tests?
- Did the affected app run successfully, and did `pnpm run gate` pass?
