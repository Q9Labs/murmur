# Repository Architecture

## Intent

Murmur uses a small pnpm monorepo so each deployable application and cross-runtime contract has one obvious home. A contributor can install once, run either application independently, and execute the complete quality gate without ignored native output or production access.

The migration preserves product behavior, Worker routes, native behavior, store metadata, app identity, and release configuration. Compatibility paths are removed once every consumer uses the canonical workspace boundary.

## Canonical Tree

```text
.
├── apps/
│   ├── mobile/
│   │   ├── app/                 # Expo Router routes only
│   │   ├── src/                 # Mobile UI and runtime code
│   │   ├── modules/murmur-audio # Expo-local native module
│   │   ├── assets/
│   │   ├── plugins/
│   │   ├── fastlane/            # Canonical submission metadata and lanes
│   │   ├── store-assets/source/ # Editable store asset masters
│   │   └── package.json
│   └── worker/
│       ├── src/
│       ├── package.json
│       ├── tsconfig.json
│       └── wrangler.toml
├── packages/
│   └── protocol/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── tooling/
│   ├── gates/
│   └── scripts/
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Root files are limited to public project documentation, workspace configuration, cross-workspace quality configuration, and GitHub automation.

## Boundaries

`@murmur/mobile` owns routes, presentation, live audio and translation orchestration, on-device provider clients, Expo configuration, release metadata, and assets. `app/` contains route entrypoints only. Mobile may import `@murmur/protocol` and its Expo-local audio module. It may not import Worker source or cross a workspace boundary with relative paths.

`@murmur/worker` owns HTTP routes, WebSocket proxies, server provider calls, logging, integrity verification, rate limiting, and legal-page rendering. Its Wrangler configuration and generated bindings live with the app. It depends only on `@murmur/protocol` within the workspace.

`@murmur/protocol` contains only language metadata, session and stable-span contracts, translation route contracts, and transport shapes used by both runtimes. It has no React, Expo, Cloudflare, Node-only, environment, provider-client, or application-state dependency. Shared types never replace Worker runtime validation of untrusted input.

The audio module remains under `apps/mobile/modules/murmur-audio`, Expo's conventional local-module path. It is not a reusable or published workspace package.

## Configuration

- One lockfile covers all private workspace packages.
- Runtime dependencies belong to the package that imports them; root owns repository tools.
- `tsconfig.base.json` is strict and environment-neutral, without includes, aliases, or platform globals.
- Mobile extends Expo's base directly. Worker and protocol use scoped configurations.
- Protocol exports explicit source subpaths and initially has no build step or project references.
- Expo SDK 54 uses `experiments.autolinkingModuleResolution` so Metro and native autolinking agree.
- Worker bindings come from `wrangler types` and remain synchronized with Wrangler configuration.
- Validators locate the repository from their file URL or an explicit root argument, never an assumed working directory.
- Fastlane metadata is the canonical submission asset tree. Unique editable source assets live under `apps/mobile/store-assets/source`; duplicate submission screenshots are not retained outside Fastlane.

## Stable Root Commands

```text
pnpm dev                 start the mobile app
pnpm dev:worker          start the Worker locally
pnpm typecheck           typecheck every workspace
pnpm test                test every workspace
pnpm gate                run the canonical non-mutating repository gate
pnpm gate:explain        describe the gate and its exclusions
```

Root scripts own orchestration, security scanning, spelling, store validation, and release checks. Live endpoints, submissions, deployments, and production changes remain explicit manual operations.

## Migration and Verification

1. Record the existing gate, Expo export, Worker dry run, and autolinking baseline.
2. Add workspace manifests without moving source.
3. Extract protocol contracts and convert both consumers to workspace imports.
4. Move Worker source and prove generated bindings, types, tests, and a dry-run bundle.
5. Move the mobile tree as one unit and prove Expo config, web export, and local-module autolinking.
6. Move tooling and release assets, repair every validator and CI path, and remove old paths.
7. Verify a frozen install, all tests, coverage thresholds, the full gate, an Android native build, an iOS build where the macOS toolchain permits it, store validation on macOS and Linux, and rewritten-history secret scans in a fresh clone.

## Anti-Slop Constraints

- Add no catch-all packages, Nx, Turborepo, custom task graph, or project-reference graph without measured need.
- Publish no workspace package.
- Leave no forwarding files, duplicate configs, old aliases, or tracked generated native output.
- Change no provider routing, app identity, store version, production URL, or deployment state during migration.
- Weaken no test, security scan, coverage threshold, or store check to accommodate paths.
- Treat oversized files and missing tests as explicit debt; relocation does not resolve them.
