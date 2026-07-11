# Murmur

Murmur is a privacy-conscious, one-way live translation app. Speak once and receive translated captions in real time, with optional translated speech for stable phrases.

The mobile client is built with Expo and React Native. A Cloudflare Worker keeps provider credentials off devices, proxies live speech recognition, translates text, and issues short-lived speech access.

## Requirements

- Node.js 22 or newer
- pnpm 10.26.2 or newer
- Xcode for local iOS builds
- Android Studio and a JDK for local Android builds
- A Cloudflare account for Worker development or deployment

## Local development

```bash
git clone https://github.com/Q9Labs/murmur.git
cd murmur
pnpm install
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm dev
```

Set `EXPO_PUBLIC_MURMUR_WORKER_URL` in `apps/mobile/.env.local` to a locally running or hosted Worker. Provider credentials belong in `apps/worker/.dev.vars`, which is ignored by Git.

Run the Worker in a second terminal:

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm dev:worker
```

Replace placeholder values in `apps/worker/.dev.vars` before requesting live provider sessions. Never add production credentials to either file.

## Quality checks

```bash
pnpm test
pnpm run gate
```

`pnpm run gate` is the canonical local contract. It runs static analysis, secret and dependency scans, type checks, tests, coverage, and store/config validation without deploying or contacting production release lanes. Root commands coordinate the `apps/mobile`, `apps/worker`, and `packages/protocol` workspaces.

## Architecture

```text
Expo app -> Murmur Worker -> Deepgram streaming speech recognition
                         -> OpenRouter text translation
                         -> Cartesia translated speech
```

The repository layout and workspace boundaries are documented in [docs/repository-architecture.md](docs/repository-architecture.md). The canonical product contract is [docs/spec.md](docs/spec.md), Continuous Mode is covered by [docs/continuous-mode-spec.md](docs/continuous-mode-spec.md), and deployment setup is in [docs/deployment-runbook.md](docs/deployment-runbook.md).

## Security and privacy

Provider keys stay server-side. The repository includes automated secret scanning and a project-specific committed-secret validator. Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). The user-facing policy is in [docs/legal/privacy-policy.md](docs/legal/privacy-policy.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Murmur is available under the [MIT License](LICENSE).
