# Murmur Deployment Runbook

This runbook describes local and hosted Worker setup without embedding account-specific credentials or release records.

## Local Worker

Copy `.env.example` to `.dev.vars`, replace placeholders, and start the Worker on localhost:

```bash
cp .env.example .dev.vars
pnpm worker:dev
```

Provider credentials and signing material must remain outside Git. Use a separate Cloudflare development environment when testing changes that could affect existing clients.

## Cloudflare configuration

Confirm the intended account before any deployment:

```bash
pnpm exec wrangler whoami
```

Configure secrets with Wrangler rather than committing values:

```bash
pnpm exec wrangler secret put DEEPGRAM_API_KEY
pnpm exec wrangler secret put OPENROUTER_API_KEY
pnpm exec wrangler secret put CARTESIA_API_KEY
pnpm exec wrangler secret put SESSION_HASH_SALT
pnpm exec wrangler secret put REPORT_ADMIN_TOKEN
pnpm exec wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
pnpm exec wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
```

Optional variables and provider routing controls are documented in `.env.example`. Keep production-only values in the Cloudflare secret store.

## Verification

Run the complete non-production gate before preparing a deployment:

```bash
pnpm run gate
```

After deploying to an approved environment, verify `/health`, `/ready`, `/privacy`, `/terms`, and `/support` at the exact deployed hostname. Production smoke checks and store submission lanes are intentionally excluded from the local gate and require explicit approval.

## Release signing

Android signing is configured through the `MURMUR_ANDROID_*` environment variables used by `scripts/build-android-release-signed.sh`. Store the keystore and its properties outside the repository. iOS credentials belong in the platform keychain or the approved CI credential store.

Never record certificate fingerprints, credential paths, console edit IDs, tester identities, deployment IDs, or production account details in tracked documentation.
