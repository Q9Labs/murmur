# Changelog

All notable changes to Murmur are documented here.

## Unreleased

### Added

- OpenAI Realtime Translation through an app-facing Worker WebSocket, including source transcripts, translated transcripts, and translated audio.
- Public contribution, security, conduct, licensing, and repository templates.
- Automated integration checks for tests, static analysis, secret scanning, and dependency review.
- A small pnpm workspace with separate mobile, Worker, and cross-runtime protocol packages.
- A repository architecture contract and workspace-aware local development commands.
- Four selectable mobile presentation variants: Field Console, Aura, Bloom, and Classic.
- Persistent UI-style preference storage and rendering coverage for the shared mobile variant flows.
- Logged mobile and Worker development commands, plus an Expo Doctor check in the canonical quality gate.
- Focused travel, talk, English-to-Arabic, and Arabic-to-English landing pages for organic discovery.
- Privacy-conscious campaign attribution, success-timed native review requests after useful sessions, and an in-app Murmur referral action without caption-content collection.

### Changed

- Unified live translation into one streaming experience and moved capture/playback to 24 kHz PCM16.
- Reworked the README and deployment documentation for reproducible public development.
- Restored Gitleaks' built-in detectors, pinned CI dependencies to immutable revisions, and replaced the licensed organization-only scanning action with the official Gitleaks CLI container.
- Moved pnpm overrides into the workspace configuration and refreshed vulnerable transitive packages to their patched releases.
- Updated Expo to the SDK 54 patch required by Expo Doctor.
- Replaced private store-operation ledgers with a minimal machine-readable readiness record.
- Updated vulnerable transitive dependencies through scoped pnpm overrides, with a time-limited exception for two unpatched Metro `image-size` advisories.
- Repositioned the English App Store and Google Play listings around live translated captions for tours and talks, with a Gulf-first growth and ASO strategy.
- Reframed the iOS and Android screenshot sets around live-caption value, tours and talks, language choice, and accountless privacy using verified app captures.
- Colocated Expo, Cloudflare Worker, native module, release, and store assets with their owning applications.
- Made the Expo Router entrypoint route-only and moved the screen controller into mobile source.
- Updated Metro workspace resolution and excluded test files from application bundles.
- Send exact PCM frame bytes to upstream realtime services when frames are views over larger buffers.
- Kept live production validation aligned with the current hosted legal-page date.

### Removed

- The previous fragmented voice pipeline and its alternate routing experiments.
- Tracked coverage output, local paths, operational session records, stale store audits, and unreferenced design prototypes.
- Obsolete token-grant client code and its unused backend wrapper.
- Duplicate store screenshots, unused image-generation helpers, stale service paths, and unused runtime exports.
