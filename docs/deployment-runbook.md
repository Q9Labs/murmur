# Murmur Deployment Runbook

This runbook describes local and hosted Worker setup without embedding account-specific credentials or release records.

## Local Worker

Copy the Worker example, replace placeholders, and start the Worker on localhost:

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm dev:worker
```

The OpenAI credential and signing material must remain outside Git. Use a separate Cloudflare development environment when testing changes that could affect existing clients.

## Cloudflare configuration

Confirm the intended account before any deployment:

```bash
pnpm --filter @murmur/worker exec wrangler whoami
```

Configure secrets with Wrangler rather than committing values:

```bash
pnpm --filter @murmur/worker exec wrangler secret put OPENAI_API_KEY --env development
pnpm --filter @murmur/worker exec wrangler secret put SESSION_HASH_SALT --env development
pnpm --filter @murmur/worker exec wrangler secret put REPORT_ADMIN_TOKEN --env development

pnpm --filter @murmur/worker exec wrangler secret put OPENAI_API_KEY --env production
pnpm --filter @murmur/worker exec wrangler secret put SESSION_HASH_SALT --env production
pnpm --filter @murmur/worker exec wrangler secret put REPORT_ADMIN_TOKEN --env production
pnpm --filter @murmur/worker exec wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --env production
pnpm --filter @murmur/worker exec wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY --env production
```

Optional variables are documented in `apps/worker/.dev.vars.example`. Keep production-only values in the Cloudflare secret store. Secret updates create a new Worker version; keep the previous credential active until an OpenAI Realtime live translation succeeds.

Deploy the isolated development Worker with:

```bash
pnpm --filter @murmur/worker exec wrangler deploy --env development
```

The development environment is `murmur-worker-development`. It has its own Durable Object namespace, secrets, and `workers.dev` hostname. Point a development app build at that hostname with `EXPO_PUBLIC_MURMUR_WORKER_URL`; do not reuse the production hostname for iteration.

## Verification

Run the complete non-production gate before preparing a deployment:

```bash
pnpm run gate
```

After deploying to an approved environment, verify `/health`, `/ready`, `/privacy`, `/terms`, and `/support` at the exact deployed hostname. Production smoke checks and store submission lanes are intentionally excluded from the local gate and require explicit approval.

## Release signing

Android signing is configured through the `MURMUR_ANDROID_*` environment variables used by `tooling/scripts/build-android-release-signed.sh`. Store the keystore and its properties outside the repository. iOS credentials belong in the platform keychain or the approved CI credential store.

Never record certificate fingerprints, credential paths, console edit IDs, tester identities, deployment IDs, or production account details in tracked documentation.
