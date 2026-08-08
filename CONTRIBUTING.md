# Contributing to Murmur

Thank you for helping improve Murmur.

## Before opening a change

1. Search existing issues and pull requests.
2. Open an issue for substantial product, architecture, privacy, or provider changes.
3. Keep provider credentials, user content, store-console data, signing material, and production identifiers out of commits and discussions.
4. Read the [TypeScript code standards](docs/code-standards.md) and preserve the repository boundaries they define.

## Development

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm dev
```

Copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars` for local Worker secrets. Both local files are ignored by Git.

## Pull requests

- Keep each change focused.
- Add or update tests for behavior changes.
- Preserve accessibility, privacy, and the accountless product contract.
- Run `pnpm run gate` and include the observed result in the pull request.
- Explain user-visible changes and any new environment variables.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `chore:`.
