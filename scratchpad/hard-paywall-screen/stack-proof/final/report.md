# Final merged-stack proof

## Source and merge

- Branch: feat/hard-paywall-screen.
- Parent merged exactly: 7486f1c05bc375d5a592f95a70b39d92b9708d47.
- Merge commit: 7c3f76f4a0433490955c8fd28fb1c05a49ab5ca2.
- Verified source tree: c9eb348c8a988d9cc6c5004ce11c042394549226.
- Before baseline: origin/master pinned to 04060ba738c491b3b0840a606611b8745f93a3ba, as in Step 1. Origin/master subsequently advanced; these images do not claim to show the later master.
- homeScreen.tsx: retained immediate freemium/unknown exhaustion sheet, unconditional refresh, fresh-or-cached routing, close-before-hard-route, dismissed-sheet behavior, separate update-required effect, and loaded/unlocked prewarm guard. Only hard destination changed to /paywall. Removed the duplicate declaration found during validation.
- homeScreen.test.ts: retained the parent's jsdom/createRoot/act harness; removed hook shim; changed hard route assertions and covered the primary-action route through the real rendered HomeExperience callback.
- Paywall remains based on isHardPaywallLocked, which uses hasTimeAvailable and the 1,000 ms minimum. No >0 check remains in paywall code/tests.

## Verification

M4 ticket 20, full history and pinned origin/master ref. Final corrected tree:

- Canonical pnpm run gate: PASS, including coverage and Expo Doctor 20/20.
- Protocol unit: 97 tests / 8 files; Worker: 432 / 64; mobile: 634 / 129.
- Typecheck and Worker generated types: PASS.
- verify:hard-paywall: PASS, 15 scenarios.
- Explicit earlier unit invocation: one inherited billing/context.test.tsx initialized-wait timeout; isolated rerun passed, and the canonical gate passed all unit files. No timeout/test behavior changed.
- Scoped Sol xhigh review: one duplicate hardPaywallLocked declaration, resolved before the green final gate. First validation of the unresolved duplicate failed; only the corrected source tree is reported green.

## Runtime artifact notes

Both master and merged-stack Release simulator apps were built on M4 with embedded JS, real RevenueCat preview public configuration, and Worker URL http://127.0.0.1:8787. Sentry upload was disabled for simulator builds only after an unauthenticated upload stopped the first build.

Unsigned artifacts initially lacked simulator keychain entitlements, so onboarding consent could not persist (-34018). A tiny native keychain probe established the simulator XML-section packaging. Corrected only temporary .app artifact packaging; native text hashes remained unchanged. No product source, customer, balance, microphone permission, or prices were faked. The corrected stack completed consent and reached onboarding step 3.

Ticket 20 was released and its checkout, simulator and companion cleaned before copying apps to the Air. A separate capture-only ticket 25 was queued behind the release lanes. Ticket 25 completed the hard-mode captures and was released; its simulator and companion were deleted/stopped. No second gate or native build was run.

## Captures

- Payload 0 on M4: a fresh, loaded customer reached /paywall from onboarding Listen without a microphone prompt. Close returned to locked Home with “Choose a plan to start translating” and See plans. Reopening See plans reached the paywall again. Account showed “0 min left on No plan”.
- Real RevenueCat/StoreKit offerings loaded, including Trip Pass $7.99 and Pro monthly $9.99; no price fixtures were used. The local harness does not enable BILLING_PURCHASES_ENABLED, so checkout CTAs are disabled in the images. Purchasing was not attempted.
- Arabic: inspected the Trip Pass and Monthly sheet. Heading, price, pack allowance line and monthly allowance line are right-aligned. Content and links fit on 390x844 without scrolling. Trip Pass and Pro remain the real store product names.
- Payload 5 on Air: both master and merged stack completed onboarding, requested microphone permission, accepted it and attempted real sessions. Played a short English sentence through the built-in speakers with the built-in microphone selected. Both reached the provider quota error instead of live captions. Both the Murmur key and the general development key independently returned credit_balance_exhausted in direct no-audio checks; no key values were logged.
- IMPORTANT: healthy live Listen and uninterrupted post-onboarding Home remain UNPROVEN. before-after-listen.png deliberately shows master’s actual quota failure. The free-mode Home images were taken after relaunch following that failure, not represented as uninterrupted onboarding captures; master Home’s status bar was not visible at capture. The default-off sheet proves the displayed ready state, not successful live translation.
- Audio captures ran on the Air because the M4 has no input device. Both Air and M4 used iPhone 13 / iOS 27, light appearance, 390x844.
- Reviewed all five final contact sheets, two tiles wide (~1000 px per tile): before-after-home.png; before-after-listen.png; before-after-account.png; switch-off-same-as-master.png; ar-paywall-after.png.

## Cleanup and handoff

Both queue slots (20 and 25) are released. Owned M4 and Air simulators were shut down and deleted, Worker processes and companions stopped, SSH forwarding stopped, original Air default audio input 138 restored. Temporary master/queue checkouts were removed. Temporary remote build artifacts and diagnostic files are removed after saving this evidence. Two Air Release apps are retained solely for a funded-key retry, avoiding another build: /tmp/murmur-pr2-final-20261022/master.app and /tmp/murmur-pr2-final-20261022/stack.app. They contain public app configuration and the localhost Worker URL, not injected backend keys. No production state changed and no PR was opened.

Implementation merge and verification-log commits were pushed to origin/feat/hard-paywall-screen. A funded OpenAI key/project is the resume condition for healthy Listen and uninterrupted onboarding proof. No native microphone fix or other product-behavior change was added in this run.
