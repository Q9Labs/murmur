# Murmur Quality Gate

`pnpm run gate` is the canonical local quality contract for humans and agents. It is intentionally non-mutating: it does not format, auto-fix, auto-restage, run live production checks, or touch Fastlane release lanes.

`pnpm run gate:explain` prints this file so agents can quickly see what the gate does before changing it.

Lefthook runs a much smaller check before each commit, in about 1 second: a Gitleaks scan of the staged diff (so a secret never enters history) and `pnpm run gate:fast` (`gate:hygiene`, `test:presence` and `store:secrets`). The rest of the gate is too slow for a hook. `.github/workflows/ci.yml` runs it on every pull request: the `test` job covers hygiene, typecheck, unit tests, coverage, test presence, syncpack, spelling and the store checks; the `static` job covers Fallow, Fallow health, Semgrep and Expo Doctor, and the advisory `osv` job runs OSV-Scanner (it fails on main today because of open node-forge, glob, minimatch and decode-uri-component advisories, so it does not block merges yet); the `secrets` job scans all commits with Gitleaks. Run `pnpm run gate` before pushing when you want everything locally, and on Instabox from the MacBook Air.

`pnpm run review:commit` runs a synchronous Codex review against the current `HEAD`. It is manual: no hook runs it, because a review on every commit costs Codex usage and minutes. Set `CODEX_REVIEW_RUNS` to a positive integer to request multiple reviews. Logs are written under `.git/codex-reviews/<short-sha>/`, outside the working tree.

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
- `pnpm run react:doctor`: pinned Expo Doctor 1.20.0 diagnostics for the React Native app stack.

The Murmur project checks are `react:doctor`, `store:secrets`, `typecheck`, `worker:types`, `unit`, `test:coverage`, `store:config`, `store:metadata`, and `store:blockers`. The blocker check validates the ledger while allowing truthful open items; `store:launch-ready` uses `store:blockers:closed` to require every P0 blocker to be closed before release.

Excluded from the hook on purpose: `store:live`, `store:preflight`, live production smoke checks, Fastlane submission validation, release lanes, and any command that mutates files.
