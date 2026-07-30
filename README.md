# Murmur

Murmur is a privacy-conscious, one-way live translation app. While you speak, it streams source captions, translated captions, and translated speech.

The mobile client is built with Expo and React Native. A Cloudflare Worker keeps provider credentials off devices and adapts a provider-neutral mobile protocol to OpenAI's Realtime Translation API.

## Requirements

- Node.js 22 or newer
- pnpm 10.26.2 or newer
- Xcode for local iOS builds
- Android Studio and a JDK for local Android builds
- A Cloudflare account for Worker development or deployment
- An OpenAI API key with access to `gpt-realtime-translate` for live sessions

## Local development

```bash
git clone https://github.com/Q9Labs/murmur.git
cd murmur
pnpm install
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm dev
```

Set `EXPO_PUBLIC_MURMUR_WORKER_URL` in `apps/mobile/.env.local`. Put `OPENAI_API_KEY` in the ignored `apps/worker/.dev.vars`, then run the Worker in a second terminal:

```bash
pnpm dev:worker
```

Never add production credentials to either file.

## Quality checks

```bash
pnpm test
pnpm run gate
```

`pnpm run gate` is the canonical local contract. It runs static analysis, secret and dependency scans, type checks, tests, coverage, and store/config validation without deploying or contacting production release lanes.

## Architecture

```text
Expo app <-- provider-neutral realtime WebSocket --> Murmur Worker
                                                       |
                                                       v
                                          OpenAI Realtime Translation
```

The app sends 24 kHz mono PCM16 audio to the Worker and receives normalized transcript events plus raw PCM16 translated audio. The Worker alone knows OpenAI's credentials and wire protocol, so a future provider can be introduced behind the same app-facing contract.

See [docs/spec.md](docs/spec.md) for the product and protocol contract and [docs/deployment-runbook.md](docs/deployment-runbook.md) for setup.

## Security and privacy

Provider keys stay server-side. The repository includes automated secret scanning and a project-specific committed-secret validator. Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). The user-facing policy is in [docs/legal/privacy-policy.md](docs/legal/privacy-policy.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Murmur is available under the [MIT License](LICENSE).
