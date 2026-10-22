# Step 1 proof, 22 October 2026

Hasan paused this task after Step 1. No parent merge, rebase, routing edit, hook-shim test port, or production change occurred. Step 2 requires the exact parent SHA from Hasan. There is no merge SHA or conflict resolution to report.

The app baseline is origin/master at 04060ba738c491b3b0840a606611b8745f93a3ba. The local Worker source is f4e880e18d569d164a68832b6449f77d9307d676. The M4 ran the native build, simulator, Worker, proofs, and gate under exclusive queue ticket 17, murmur-stack-step1-20261022. The checkout has full history and an origin/master ref. No heavy work ran on the Air.

## Local Worker command

`pnpm run dev:hard-paywall -- --free-minutes 0` serves the real Worker at http://127.0.0.1:8787. The command also accepts 5 and an optional `--port`. The app used `EXPO_PUBLIC_MURMUR_WORKER_URL=http://127.0.0.1:8787`.

The script creates ephemeral D1, applies every migration, and uses the real CustomerLedger Durable Object. Only outbound PostHog responses are stubbed. Other vendor requests use the real network. The command stops on signals and has a four-hour lifetime.

The script accepts OPENAI_API_KEY, REVENUECAT_API_KEY, and REVENUECAT_PROJECT_ID through its environment. The app captures used the first two through 2password and the project ID from wrangler.toml. Missing keys do not produce fake vendor responses. Realtime or reconciliation then fails normally. Billing purchases retain the Worker's disabled default. No store purchase was attempted.

The new command shares bundleWorkerProof with the two existing verification scripts. The helper matches the parent's existing tooling helper. This extraction does not import the parent's product changes or change either verification script's scenarios.

## Real app observations

The lane created its own iPhone 13 simulator on iOS 27.0. The viewport is 390 by 844 points. Captures are 1170 by 2532 pixels, in English. Each requested baseline view used a separate fresh installation and keychain reset.

Real RevenueCat offerings loaded through the native StoreKit SDK. The default_130 offering returned the products. The captured Monthly screen shows Pro at $9.99 a month and Pro Max at $29.99 a month. No price fixtures or customer fixtures were used. The Account screen shows the real local Worker's five-minute Free balance.

Master's final onboarding Listen action immediately starts translation. A microphone permission prompt appeared. After Allow, the Worker created a real session, but the app aborted in native audio setup. The M4 reports only Mac mini Speakers and no audio input device. The native exception is `required condition is false: IsFormatSampleRateAndChannelCountValid(format)`.

The crash occurs at inputNode.installTap in /Users/macmini/code/murmur/.worktrees/hard-paywall-screen/apps/mobile/modules/murmur-audio/ios/MurmurAudioModule.swift:171. The crash reproduced across fresh installations. No native product fix was made in this round.

The Home capture therefore shows Home after relaunch following that crash. It is not a successful first-run Listen capture. The Listen capture shows SpringBoard after the crash. A healthy Listen screen and an uninterrupted home immediately after onboarding could not be captured under the M4-only rule. The Account capture also follows relaunch, in its separate fresh-install flow.

The first Account attempt showed reconciliation_failed because the local Worker lacked the RevenueCat read API configuration. The local script now accepts those real vendor bindings. The final Account capture has no reconciliation error.

## Verification

The final files on the M4 matched the local source files by SHA-256.

The live HTTP check at payload 5 passed. A real anonymous customer has free_allowance_ms 300000, available_ms 300000, and a claimable Phone audio gift. At payload 0, the live check passed with both values at zero and the gift not claimable. Both checks passed again after the shared-helper extraction.

`pnpm run verify:hard-paywall` passed all 9 scenarios. `pnpm run verify:caption-recovery` passed all 27 scenarios.

`pnpm run gate` passed gate hygiene but exited 1 at Fallow. Fallow reports unused expo-splash-screen, duplicate freeAllowanceMs exports, and three duplication groups. The remaining clone IDs are c6e7357f, 2538d7ec, and 4f5a8bb3. A separate run with every edited file restored to pristine f4e880e reproduces both dead-code findings and those clone groups. Pristine f4e880e also has the Worker-bundling clone 2e0486e1, which this extraction removes. No new Fallow finding remains.

The gate is not green. The remaining gate steps, including typechecks, unit tests, coverage, and Expo Doctor, did not run. This is not the merged-stack verification requested for Step 2.

## Saved images and evidence

The reviewed, two-tile contact sheets are /Users/macmini/code/murmur/.worktrees/hard-paywall-screen/scratchpad/hard-paywall-screen/stack-proof/master-home-and-listen.png and /Users/macmini/code/murmur/.worktrees/hard-paywall-screen/scratchpad/hard-paywall-screen/stack-proof/master-account-and-offerings.png. Each tile is about 1000 pixels wide.

The requested raw views are /Users/macmini/code/murmur/.worktrees/hard-paywall-screen/scratchpad/hard-paywall-screen/stack-proof/master-home.png, /Users/macmini/code/murmur/.worktrees/hard-paywall-screen/scratchpad/hard-paywall-screen/stack-proof/master-listen.png, and /Users/macmini/code/murmur/.worktrees/hard-paywall-screen/scratchpad/hard-paywall-screen/stack-proof/master-account.png.

The same directory contains master-plans.png, master-onboarding-microphone.png, the crash reason and summary, the audio-device inventory, proof-results.json, both verification logs, final-gate.log, and preexisting-fallow.log.

The five requested before-and-after sheets are deferred with Step 3. No merged hard-mode screenshots, Arabic alignment proof, payload-5 stack comparison, or close-and-reopen proof was attempted.

## Simulator control notes

The installed idb CLI has a broken Python 3.11 link. The existing Python 3.12 interpreter runs it with its existing site-packages on PYTHONPATH. Xcode 27 moved SimulatorKit.framework to Contents/SharedFrameworks. A task-local Xcode directory with that framework symlink, selected through FBXCTEST_XCODE_PATH_OVERRIDE, restored idb taps. The shared Xcode installation was not changed.

The one-off queue and simulator drivers lived under /tmp. The permanent local Worker command and shared bundler live under tooling/scripts.

The M4 queue job finished with exit 0. Its temporary checkout, Worker worktree, Fallow worktree, native DerivedData, and simulator were removed. The task's native app, Worker, Metro, and idb processes stopped. No listener remains on either local Worker port.
