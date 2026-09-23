# Murmur Support and Deletion

Last updated: 2026-09-23

This document defines Murmur's support and deletion surface. The production Worker hosts the public support page.

## Support Contact

Current public support surface:

- Public support URL: `https://murmur.q9labs.ai/support`.
- Support email address: `q9labs.ai@gmail.com`.
- The response window and escalation path for harmful, offensive, or safety-related translation reports still need an operational owner before public launch.

## Accounts and Deletion

Murmur creates a random guest customer account when the app first starts. Guests can purchase, restore, and reconcile purchases without an email or registered account. A user can optionally save a guest purchase to an Apple, Google, or email account; Murmur links the guest's purchase and remaining balance to that account. Murmur does not retain full transcript history by default.

If a user consents to AI session insights, Murmur stores the derived insight, not the transcript, for up to 24 months from creation. Turning off AI session insights stops future processing but does not automatically delete existing insights. The user can ask support to delete an existing insight or related server-side record using an approximate session date and any available session or report receipt details.

Use Delete Murmur account in Account & billing to remove sign-in data and access to the remaining balance. It does not cancel an Apple or Google subscription, which must be cancelled through the relevant store. Murmur may retain a pseudonymous financial and entitlement record when needed for refunds, fraud prevention, reconciliation, and legal obligations.

The app stores anonymous install and Free-allowance identifiers, interface preference, and rating-prompt eligibility state on the device. Use Reset Murmur Identity to replace the diagnostic install identifier without changing billing, or Delete Local Data to clear local Murmur data and the privacy acknowledgement. A hashed current-month Free claim can remain on the server through that month for abuse prevention.

Anonymous Analytics can be turned off in Settings. This stops new product analytics events, install-attribution reporting, and session replay. Essential sanitized crash and error monitoring can continue. AI session insights use a separate consent control.

## Server-Side Deletion Requests

Murmur may process rate-limit metadata, analytics, session insights, diagnostics, and translation report receipts. Support can review deletion requests for records that can reasonably be tied to a user-supplied receipt or anonymous install/session metadata.

Support must not ask users to send microphone recordings, full transcripts, government IDs, passwords, private keys, or app store credentials.

## Report Translation Triage

Murmur's in-app report categories are inaccurate, wrong language, harmful or offensive, speech issue, and other. The operational workflow still needs an owner, an escalation path, report-retention timing, and a deletion procedure before public launch.

## Store Submission Requirements

Before App Store or Google Play submission, provide:

- Public privacy policy URL.
- Public terms URL.
- Public support URL.
- Guest-account, guest-purchase, billing, Restore, and deletion steps in reviewer notes.
- In-app report translation path.
- Data-retention and deletion explanation for session insights, diagnostics, and reports.

## Production Checklist

- Host privacy policy, terms, and support/deletion pages on a stable domain.
- Verify third-party provider retention and model-training settings.
- Confirm report-triage ownership, escalation, retention, and deletion.
- Verify App Store privacy and Google Play Data Safety answers against the final implementation.
- Confirm support can handle deletion requests tied to session insights, report receipts, or anonymous install/session metadata.
- Confirm account deletion, store cancellation, refunds, and Restore use the documented entitlement process.
