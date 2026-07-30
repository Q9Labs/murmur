# Changelog

All notable changes to Murmur are documented here.

## Unreleased

### Added

- OpenAI Realtime Translation through a provider-neutral Worker WebSocket, including source transcripts, translated transcripts, and translated audio.
- Public contribution, security, conduct, licensing, and repository templates.
- Continuous integration for tests, static checks, secret scanning, and dependency review.
- A small pnpm workspace with separate mobile, Worker, and cross-runtime protocol packages.
- A repository architecture contract and workspace-aware local development commands.
- Four selectable mobile presentation variants: Field Console, Aura, Bloom, and Classic.
- Persistent UI-style preference storage and rendering coverage for the shared mobile variant flows.
- Logged mobile and Worker development commands, plus an Expo Doctor check in the canonical quality gate.

### Changed

- Unified live translation into one streaming experience and moved capture/playback to 24 kHz PCM16.
- Reworked the README and deployment documentation for reproducible public development.
- Replaced private store-operation ledgers with a minimal machine-readable readiness record.
- Updated vulnerable transitive `undici` versions through scoped pnpm overrides.
- Colocated Expo, Cloudflare Worker, native module, release, and store assets with their owning applications.
- Made the Expo Router entrypoint route-only and moved the screen controller into mobile source.
- Updated Metro workspace resolution and excluded test files from application bundles.
- Send exact PCM frame bytes to Deepgram and Ultravox when frames are views over larger buffers.

### Removed

- The Phrase/Continuous mode split and the previous multi-provider speech, translation, and speech-generation stack.
- Tracked coverage output, local paths, operational session records, stale store audits, and unreferenced design prototypes.
- Obsolete Deepgram token-grant client code and its unused backend wrapper.
- Duplicate store screenshots, unused image-generation helpers, stale service paths, and unused runtime exports.
