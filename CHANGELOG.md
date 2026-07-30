# Changelog

All notable changes to Murmur are documented here.

## Unreleased

### Added

- Public contribution, security, conduct, licensing, and repository templates.
- Continuous integration for tests, static checks, secret scanning, and dependency review.
- A small pnpm workspace with separate mobile, Worker, and cross-runtime protocol packages.
- A repository architecture contract and workspace-aware local development commands.
- Four selectable mobile presentation variants: Field Console, Aura, Bloom, and Classic.
- Persistent UI-style preference storage and rendering coverage for the shared mobile variant flows.
- Logged mobile and Worker development commands, plus an Expo Doctor check in the canonical quality gate.

### Changed

- Reworked the README and deployment documentation for reproducible public development.
- Restored Gitleaks' built-in detectors, pinned CI dependencies to immutable revisions, and replaced the licensed organization-only scanning action with the official Gitleaks CLI container.
- Moved pnpm overrides into the workspace configuration and refreshed vulnerable transitive packages to their patched releases.
- Updated Expo to the SDK 54 patch required by Expo Doctor.
- Replaced private store-operation ledgers with a minimal machine-readable readiness record.
- Updated vulnerable transitive `undici` versions through scoped pnpm overrides.
- Colocated Expo, Cloudflare Worker, native module, release, and store assets with their owning applications.
- Made the Expo Router entrypoint route-only and moved the screen controller into mobile source.
- Updated Metro workspace resolution and excluded test files from application bundles.
- Send exact PCM frame bytes to Deepgram and Ultravox when frames are views over larger buffers.

### Removed

- Tracked coverage output, local paths, operational session records, stale store audits, and unreferenced design prototypes.
- Obsolete Deepgram token-grant client code and its unused backend wrapper.
- Duplicate store screenshots, unused image-generation helpers, stale service paths, and unused runtime exports.
