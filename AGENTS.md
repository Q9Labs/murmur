# Murmur Agent Notes

- Speaker diarization feature work lives in the sibling worktree `../murmur-speaker-diarization` on branch `feature/speaker-diarization`.
- Before committing, pushing, or opening a PR from this repo, run `pnpm run gate`; it is the canonical non-mutating quality contract shared by agents, humans, and Lefthook.
- Use `pnpm run gate:explain` for the current gate map. The hook intentionally excludes `store:live`, `store:preflight`, live production smoke checks, Fastlane submission validation, and release lanes.
