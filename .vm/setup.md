# Murmur Oort worker setup

Oort reads this file before Codex starts, but it does not run these commands for the worker. Run the relevant section before working. The controller maps credentials into the worker environment. Do not add credential values to Git.

## Runtime

- Node.js 22 or newer.
- pnpm 10.26.2, pinned in `package.json` and already installed by Oort.

## Oort mappings

- `OORT_GITHUB_TOKEN` clones and pushes the isolated `oort/<worker-id>` branch.
- `GH_TOKEN` lets Oort open the resulting pull request.
- `OPENAI_API_KEY` is available only when a task needs a live local Worker session.

## Baseline bootstrap

Run this from the repository root for every worker:

```sh
pnpm install --frozen-lockfile
```

`pnpm test` and `pnpm run gate` do not require local environment files or provider credentials.

## Live local stack

Use this section when the task needs real translation traffic or browser QA. It creates ignored, mode-`0600` development files from Oort's mapped key.

```sh
set -Eeuo pipefail
: "${OPENAI_API_KEY:?Oort must map OPENAI_API_KEY for a live Worker session}"

printf '%s\n' \
  'MURMUR_ENV=development' \
  'MURMUR_REQUIRE_DEVICE_INTEGRITY=false' \
  'OPENAI_REALTIME_MODEL=gpt-realtime-translate' \
  > apps/worker/.dev.vars
printf 'OPENAI_API_KEY=%s\n' "$OPENAI_API_KEY" >> apps/worker/.dev.vars
chmod 600 apps/worker/.dev.vars

printf '%s\n' \
  'EXPO_PUBLIC_MURMUR_WORKER_URL=http://127.0.0.1:8787' \
  > apps/mobile/.env.local
chmod 600 apps/mobile/.env.local
```

Start the Worker first, then the Expo app in a second terminal:

```sh
pnpm dev:worker
pnpm dev
```

- Worker port: `8787`; readiness check: `curl --fail http://127.0.0.1:8787/health`.
- Expo Metro port: `8081` by default.
- Agent-browser inside the worker can test this local pair directly.

`vm preview <worker-id> <port>` exposes one worker port through Tailscale Serve. An Expo preview configured with `127.0.0.1:8787` cannot make live requests from the operator's browser because that address resolves on the operator's machine. For an operator-visible live translation preview, set `EXPO_PUBLIC_MURMUR_WORKER_URL` to a reachable development Worker URL. Deploying or changing Cloudflare environments requires an explicit task request.

## Verification

Run the smallest relevant check first. Before a handoff that changes code, run:

```sh
pnpm test
pnpm run gate
```

`pnpm run gate` is Murmur's canonical non-mutating quality contract. Do not run store release or deployment lanes unless the task explicitly requires them.

## Project constraints

- Keep OpenAI credentials in the Worker. The mobile app must never receive provider keys.
- Use `../murmur-speaker-diarization` for speaker-diarization work. Do not add it to this checkout.
- The current launch work is the logo, bloom UI polish, store screenshots, and publishing. Do not expand scope without an explicit request.
