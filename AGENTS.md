# Murmur Agent Notes

## Current launch focus

Murmur's remaining launch work is intentionally narrow:

1. Wire in the new logo.
2. Polish the UI (love the bloom direction only).
3. Capture the redesigned store screenshots.
4. Publish the app.

Treat these as the current next steps. Do not expand the scope with unrelated feature work unless Hasan asks.

- Speaker diarization feature work lives in the sibling worktree `../murmur-speaker-diarization` on branch `feature/speaker-diarization`.
- Before pushing or opening a PR from this repo, run `pnpm run gate`; it is the canonical non-mutating quality contract shared by agents and humans. CI runs all of it. The Lefthook pre-commit hook runs only a staged-secret scan and `pnpm run gate:fast` (about 1 s), so run the full gate on Instabox, not on the MacBook Air.
- Use `pnpm run gate:explain` for the current gate map. The gate intentionally excludes `store:live`, `store:preflight`, live production smoke checks, Fastlane submission validation, and release lanes.
- Dev server output is mirrored to `.logs/dev-server.log` when using logged dev scripts such as `pnpm run dev`, `pnpm run start`, or `pnpm run worker:dev`. When debugging a running app, inspect the latest output with `tail -n 200 .logs/dev-server.log`.
