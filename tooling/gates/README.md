# Murmur Quality Gate

`pnpm run gate` is the canonical local quality contract for humans, agents, and Lefthook. It is intentionally non-mutating: it does not format, auto-fix, auto-restage, run live production checks, or touch Fastlane release lanes.

`pnpm run gate:explain` prints this file so agents can quickly see what the gate does before changing it.

`pnpm run review:commit` runs a synchronous Codex review against the current `HEAD`. Set `CODEX_REVIEW_RUNS` to a positive integer to request multiple reviews. Logs are written under `.git/codex-reviews/<short-sha>/`, outside the working tree.

`pnpm run gate:hygiene` checks that the gate is real: scripts referenced from `tooling/gates/commit.sh` must exist, placeholder scripts such as `echo`, `true`, and `exit 0` are rejected, `--passWithNoTests` is rejected, and live/release/Fastlane lanes stay out of the hook.

`pnpm run test:presence` requires meaningful Murmur source files to have nearby tests. The policy intentionally excludes generated files, declarations, barrels, assets, styles, configs, scripts, migrations, docs, store metadata, Fastlane, and release/live validation lanes.

The static and security layers are:

- `pnpm run static:fallow`: changed-code audit with `fallow audit`; existing dead-code, complexity, and duplication backlog is captured in reviewed baselines under `tooling/gates/fallow-baselines/`, so the gate blocks regressions instead of demanding instant cleanup of inherited findings.
- `pnpm run static:fallow:health`: project health, hotspots, and targets with `FALLOW_MIN_SCORE` defaulting to the reviewed bootstrap floor of `45`. Raise `FALLOW_MIN_SCORE` as refactors improve the score.
- `pnpm run static:semgrep`: baseline Semgrep rules under `.semgrep/`.
- `pnpm run security:secrets`: Gitleaks secret scan.
- `pnpm run security:osv`: OSV-Scanner dependency vulnerability scan.
- `pnpm run deps:syncpack`: dependency/version policy.
- `pnpm run lint:spelling`: CSpell typo hygiene.

The Murmur project checks are `store:secrets`, `typecheck`, `worker:types`, `unit`, `test:coverage`, `store:config`, `store:metadata`, and `store:blockers`.

Excluded from the hook on purpose: `store:live`, `store:preflight`, live production smoke checks, Fastlane submission validation, release lanes, and any command that mutates files.
