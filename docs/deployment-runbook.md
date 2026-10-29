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
pnpm worker:deploy:development
```

Use `pnpm worker:deploy:sandbox` or `pnpm worker:deploy:production` for those targets. The release script requires `SENTRY_AUTH_TOKEN`, applies the target's D1 migrations before deployment, and links the deployed revision to Sentry. A migration failure stops the release before new code is published.

The development environment is `murmur-worker-dev`. It has its own Durable Object namespace, secrets, and `workers.dev` hostname. Point a development app build at that hostname with `EXPO_PUBLIC_MURMUR_WORKER_URL`; do not reuse the production hostname for iteration.

**Production compatibility path:** the old `murmur-worker-development` name belongs to a proxy in `apps/worker/legacy-ios-proxy` that forwards every request to production. iOS 1.2.2 shipped pointing at that hostname, so the proxy keeps those installs metered and billed. Deploy it with `pnpm --filter @murmur/worker exec wrangler deploy -c legacy-ios-proxy/wrangler.toml`, and delete it once iOS installs have moved to a release built on the production profile.

## Authentication dependency upgrade

Better Auth 1.7.3+ no longer writes the `account.issuer` column introduced by 1.7.0–1.7.2. Migration 0018 retains existing issuer values but makes the field optional, preserving old writers while allowing new ones. It first checks uniqueness of `(providerId, accountId)`; ambiguous legacy keys stop the migration before account data is changed. It does not merge identities. Apply the reviewed migration before the new Worker, using the existing migration-first release helper. No remote account inventory or migration is performed by the local gate.

Before an authorized release, have the database owner check duplicate provider/account keys without exporting user records. Resolve ambiguous identities separately; do not bypass the unique-key guard. Keep a database backup and the previous Worker revision. Retaining the column permits old writes, but returning to 1.7.2 after new accounts have been created needs an identity-data review: new rows have no issuer and the old library may not find them. Do not assume an automatic rollback is safe. See the [upstream upgrade guide](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/1-7-upgrade-guide.mdx).

## Mobile targets

| Build profile / update channel | Worker target |
| --- | --- |
| `development`, `preview`, `testing` | Isolated `murmur-worker-dev` |
| `sandbox` | Isolated `murmur-worker-sandbox` |
| `production` | Live `murmur.q9labs.ai` |

`preview` formerly pointed at production; builds from the corrected profile use dev. Existing preview binaries retain their embedded URL until rebuilt or updated on their own channel. `preview`, `testing`, and `sandbox` explicitly select the remote `preview` environment; `development` and `production` select their matching environments. The runtime checks the native update channel against the explicit environment and canonical Worker URL. A missing or mismatched release target fails before making a Worker request. Signed-build CI produces artifacts and does not publish an OTA or store release. Never use the legacy iOS proxy as a non-production target.

## Verification

Run the complete non-production gate before preparing a deployment:

```bash
pnpm run gate
```

After deployment, verify `/health`, `/ready`, `/privacy`, `/terms`, and `/support` at the exact deployed hostname. The local gate does not run production smoke checks or store submission lanes.

## Release signing

Android signing is configured through the `MURMUR_ANDROID_*` environment variables used by `tooling/scripts/build-android-release-signed.sh`. Store the keystore and its properties outside the repository. iOS credentials belong in the platform keychain or the approved CI credential store.

Never record certificate fingerprints, credential paths, console edit IDs, tester identities, deployment IDs, or production account details in tracked documentation.

## Expo OTA updates

EAS Update can deliver JavaScript, copy, translations, UI, bundled assets, and bug fixes to installed builds when those changes use the native capabilities already in the build. A store build is required for any native module, permission, config plugin, Expo SDK, or `expo-updates` configuration change.

Use the root helper, which requires a target, loads that profile's backend, and passes explicit channel and remote environment arguments. It does not default to production. Inspect the command without publishing:

```sh
pnpm mobile:update preview "Describe the update" --dry-run
```

Before an authorized publication, inspect `eas env:list preview` and `eas channel:view preview` from `apps/mobile`. Remote channel mappings can change independently of this repository. Then omit `--dry-run` to publish the dev-backed preview. Use the matching profile for `development`, `testing`, or `sandbox`.

For an authorized production OTA, explicitly select production; an optional third argument sets the rollout percentage:

```sh
pnpm mobile:update production "Describe the update" 10
```

Raw `eas update` does not inherit `build.<profile>.env`. Missing release configuration now fails rather than defaulting to production. Production builds with the existing explicit production environment, URL, and channel remain supported. The installed binary's native channel is checked at runtime, so production variables delivered to a preview binary are rejected. Existing binaries still run their old code until rebuilt or updated; this patch does not change remote mappings or already published bundles. The legacy iOS proxy remains production-backed and is rejected as a nonproduction URL.

Republish a previously published update from production or use the guided rollback to return to the previous update (or the embedded update if there is no previous one):

```bash
eas update:republish --channel production
eas update:rollback
```

Apple forbids OTA changes that alter the app's main purpose ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). See Expo's [rollout](https://docs.expo.dev/eas-update/rollouts/) and [rollback](https://docs.expo.dev/eas-update/rollbacks/) guides for the release controls.
