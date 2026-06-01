# Murmur

Murmur is being rebuilt as a one-way live translator: speak once, see translated captions flow in real time, and optionally hear translated speech behind stable phrase chunks.

The canonical product and implementation direction lives in [docs/spec.md](docs/spec.md).

## Current State

The old prototype implementation has been removed because it encoded the wrong architecture: client-side provider keys, file-chunk audio capture, stale translation models, and no production speech output path.

This repo is intentionally a minimal Expo shell while the new stack is rebuilt.

## Target Stack

- Mobile app: Expo / React Native
- Speech-to-text: Deepgram Nova-3 streaming
- Translation: Cloudflare Worker -> OpenRouter `google/gemma-4-26b-a4b-it`
- Speech generation: Cartesia Sonic 3.5
- Package manager: `pnpm`

## Development

```bash
pnpm install
pnpm start
pnpm typecheck
```
