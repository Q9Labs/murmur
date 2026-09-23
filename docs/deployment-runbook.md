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

Apply pending billing migrations before any direct Worker deployment:

```bash
pnpm --filter @murmur/worker exec wrangler d1 migrations apply BILLING_DB --env development --remote
```

Use the matching environment (`development`, `sandbox`, or `production`) for the target database. `tooling/scripts/deploy-worker-release.mjs` applies pending D1 migrations automatically before its Worker deploy step; a migration failure stops the release before new code is published.

Deploy the isolated development Worker with:

```bash
pnpm --filter @murmur/worker exec wrangler deploy --env development
```

The development environment is `murmur-worker-dev`. It has its own Durable Object namespace, secrets, and `workers.dev` hostname. Point a development app build at that hostname with `EXPO_PUBLIC_MURMUR_WORKER_URL`; do not reuse the production hostname for iteration.

The old `murmur-worker-development` name belongs to a proxy in `apps/worker/legacy-ios-proxy` that forwards every request to production. iOS 1.2.2 shipped pointing at that hostname, so the proxy keeps those installs metered and billed. Deploy it with `pnpm --filter @murmur/worker exec wrangler deploy -c legacy-ios-proxy/wrangler.toml`, and delete it once iOS installs have moved to a release built on the production profile.

## Verification

Run the complete non-production gate before preparing a deployment:

```bash
pnpm run gate
```

After deploying to an approved environment, verify `/health`, `/ready`, `/privacy`, `/terms`, and `/support` at the exact deployed hostname. Production smoke checks and store submission lanes are intentionally excluded from the local gate and require explicit approval.

## Release signing

Android signing is configured through the `MURMUR_ANDROID_*` environment variables used by `tooling/scripts/build-android-release-signed.sh`. Store the keystore and its properties outside the repository. iOS credentials belong in the platform keychain or the approved CI credential store.

Never record certificate fingerprints, credential paths, console edit IDs, tester identities, deployment IDs, or production account details in tracked documentation.

## Expo OTA updates

EAS Update can deliver JavaScript, copy, translations, UI, bundled assets, and bug fixes to installed builds when those changes use the native capabilities already in the build. A store build is required for any native module, permission, config plugin, Expo SDK, or `expo-updates` configuration change.

Publish to the production channel:

```bash
eas update --channel production --message "Describe the update"
```

Start a staged rollout at 10% with `--rollout-percentage`; adjust an active rollout with `eas update:edit`:

```bash
eas update --channel production --message "Describe the update" --rollout-percentage=10
```

Republish a previously published update from production or use the guided rollback to return to the previous update (or the embedded update if there is no previous one):

```bash
eas update:republish --channel production
eas update:rollback
```

Apple forbids OTA changes that alter the app's main purpose ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). See Expo's [rollout](https://docs.expo.dev/eas-update/rollouts/) and [rollback](https://docs.expo.dev/eas-update/rollbacks/) guides for the release controls.
