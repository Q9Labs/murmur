#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Fail if this gate relies on placeholder, no-op, weak, or missing scripts.
pnpm run gate:hygiene

# Run deterministic JS/TS codebase intelligence for changed-code risk, dead code, duplication, complexity, and dependency hygiene.
pnpm run static:fallow

# Report health score, hotspots, and refactor targets so new smell cannot hide behind passing tests.
pnpm run static:fallow:health

# Run custom Semgrep rules for security, forbidden APIs, architecture, and agent-safety patterns.
pnpm run static:semgrep

# Scan the repo for API keys, tokens, passwords, private keys, and credential leaks.
pnpm run security:secrets

# Scan dependency manifests and lockfiles for known vulnerabilities across supported ecosystems.
pnpm run security:osv

# Enforce package.json dependency/version policy.
pnpm run deps:syncpack

# Catch typos in identifiers, comments, docs, config, and user-facing copy.
pnpm run lint:spelling

# Diagnose common Node.js, iOS, Android, and React Native project health issues.
pnpm run react:doctor

# Require meaningful source files to have matching tests unless explicitly excluded.
pnpm run test:presence

# Run Murmur's project-specific secret validator.
pnpm run store:secrets

# Typecheck the Expo app and shared TypeScript surface.
pnpm run typecheck

# Typecheck the Cloudflare Worker project specifically.
pnpm run worker:types

# Run the unit test suite.
pnpm run unit

# Run coverage thresholds.
pnpm run test:coverage

# Validate app configuration needed for release/store correctness.
pnpm run store:config

# Validate iOS/Android store metadata and required store assets.
pnpm run store:metadata

# Validate release/submission blockers file state.
pnpm run store:blockers
