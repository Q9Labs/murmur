# Murmur Support and Deletion

Last updated: 2026-09-23

This document defines Murmur's support and deletion surface. The production Worker hosts the public support page.

## Support Contact

Current public support surface:

- Public support URL: https://murmur.q9labs.ai/support.
- Support email address: q9labs.ai@gmail.com.
- The response window and escalation path for harmful, offensive, or safety-related translation reports still need an operational owner before public launch.

## Accounts and Deletion

Murmur creates a random guest customer account when the app first starts. Guests can purchase, restore, and reconcile purchases without an email or registered account. A user can optionally save a guest purchase to an Apple, Google, or email account; Murmur links the guest's purchase and remaining balance to that account. Murmur does not keep cloud transcript history. For eligible paid users, Murmur saves translated captions locally on the device only.

With Apple sign-in, Murmur stores your email address and, if you share it with Apple on first sign-in, your name with your account until account deletion. Google sign-in provides your email address and, when available, your name and profile image; Murmur stores the profile information Google provides with your account until account deletion.

Deleting a Murmur account removes the account and authentication records, associated Session Insights, and rating responses linked to that account. The billing ledger may retain deleted-state purchase, entitlement, usage, refund, and reconciliation records. Account deletion does not cancel an Apple or Google subscription and does not erase local translation history.

If a user consents to AI Session Insights, translated text from that consented session is sent to OpenRouter to create a derived insight. Turning off AI Session Insights stops collection for future sessions but does not delete existing insights. A daily job deletes insights after 24 months; account deletion removes associated insights sooner.

A user-submitted rating survey sends stars, use-case choice, and optional Other text directly to Murmur's server, independently of Anonymous Analytics, and is retained for 24 months. Account deletion removes account-linked survey responses. Anonymous ratings have no account link and are not found by account deletion.

The app stores anonymous install and Free-allowance identifiers, interface preference, rating-prompt eligibility state, and eligible paid users' translation history on the device. Reset Murmur Identity replaces the diagnostic install identifier without changing billing. Delete Local Data clears local Murmur data, including local translation history and the privacy acknowledgement. Deleting an individual history entry also removes that entry. Account deletion alone does not clear on-device data.

Anonymous Analytics can be turned off in Settings. This stops new relayed PostHog product events and install-attribution reporting; the app stops session recording and opts the direct PostHog replay client out. Essential sanitized Sentry crash and error monitoring can continue. AI Session Insights has a separate consent control.

## Server-Side Deletion Requests

Reports are not automatically deleted when an account is deleted. Support deletes a report on request when the user provides its report receipt. If REPORT_WEBHOOK_URL is configured, the submitted report may also be sent to that endpoint; the endpoint operator may retain its own copy.

PostHog and Sentry records expire under those providers' retention settings. Murmur does not automatically erase an individual's analytics or diagnostic records from those services when an account is deleted. Better Auth session IP address and user-agent data remain until the session expires or the account is deleted. The hashed analytics rate-limit address and timestamps are kept for up to one hour.

Support must not ask users to send microphone recordings, full transcripts, government IDs, passwords, private keys, or app store credentials.

## Report Translation Triage

Murmur's in-app report categories are inaccurate, wrong language, harmful or offensive, speech issue, and other. Support handles report deletion requests manually using the report receipt; reports are not removed by account deletion. The response window and escalation path for harmful, offensive, or safety-related reports still need an operational owner before public launch.

## Store Submission Requirements

Before App Store or Google Play submission, provide:

- Public privacy policy URL.
- Public terms URL.
- Public support URL.
- Guest-account, guest-purchase, billing, Restore, and deletion steps in reviewer notes.
- In-app report translation path.
- Data-retention and deletion explanation for Session Insights, rating surveys, diagnostics, and reports.

## Production Checklist

- Host privacy policy, terms, and support/deletion pages on a stable domain.
- Verify OpenAI and OpenRouter request-retention and model-training settings against their provider terms.
- Confirm the manual report-deletion procedure and how configured webhook copies are handled.
- Verify App Store privacy and Google Play Data Safety answers against the final implementation.
- Confirm account deletion removes authentication records, Session Insights, and account-linked ratings, while making clear that it does not erase local history, store subscriptions, or provider-side analytics and diagnostics.
- Confirm support, store cancellation, refunds, and Restore use the documented entitlement process.
