# Changelog

All notable changes to Murmur are documented here.

## Unreleased

### Added

- Public contribution, security, conduct, licensing, and repository templates.
- Continuous integration for tests, static checks, secret scanning, and dependency review.
- A small pnpm workspace with separate mobile, Worker, and cross-runtime protocol packages.
- A repository architecture contract and workspace-aware local development commands.

### Changed

- Reworked the README and deployment documentation for reproducible public development.
- Replaced private store-operation ledgers with a minimal machine-readable readiness record.
- Updated vulnerable transitive `undici` versions through scoped pnpm overrides.
- Colocated Expo, Cloudflare Worker, native module, release, and store assets with their owning applications.
- Made the Expo Router entrypoint route-only and moved the screen controller into mobile source.

### Removed

- Tracked coverage output, local paths, operational session records, stale store audits, and unreferenced design prototypes.
- Obsolete Deepgram token-grant client code and its unused backend wrapper.
- Duplicate store screenshots, unused image-generation helpers, stale service paths, and unused runtime exports.
