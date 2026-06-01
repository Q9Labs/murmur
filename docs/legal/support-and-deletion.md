# Murmur Support And Deletion Draft

Last updated: 2026-05-17

This draft defines the support and deletion surface Murmur needs before external testing or public release. It is hosted by the production Worker and must still be reviewed against the final provider settings before App Store or Google Play submission.

## Support Contact

Current public support surface:

- Public support URL: `https://murmur.q9labs.ai/support`.
- Support email address: `q9labs.ai@gmail.com`.
- Expected response window and escalation path for harmful, offensive, or safety-related translation reports still need an operational owner before public launch.

## Accountless App Explanation

Murmur V1 does not create accounts. There is no login, profile, password, subscription account, cloud transcript history, or account deletion flow.

The app does store an anonymous install identifier on the device. The app includes:

- Reset Murmur Identity: replaces the anonymous install id.
- Delete Local Data: clears the anonymous install id and local privacy acknowledgement.

## Server-Side Deletion Requests

Because Murmur may process rate-limit metadata, diagnostic records, and translation report receipts, support must provide a deletion path for server-side records that can reasonably be tied to a user-supplied receipt or anonymous install/session metadata.

Support request intake should ask for:

- Report receipt id, if the user is asking about a translation report.
- Approximate date/time and language pair, if the user is asking about diagnostics.
- Anonymous install/session metadata only if the app exposes a safe way to copy it.

Support must not ask users to send microphone recordings, full transcripts, government IDs, passwords, private keys, or app store credentials.

## Report Translation Triage

Murmur's in-app report categories are:

- Inaccurate.
- Wrong language.
- Harmful or offensive.
- Speech issue.
- Other.

Production report triage is configured through `REPORT_ADMIN_TOKEN` and the Worker admin inbox. The inbox stores report metadata without raw source captions, translated captions, or user notes, and supports admin deletion by report receipt id. Before public launch, the operational workflow must still define who reviews reports, how harmful reports are escalated, how long reports are retained, and how report data is deleted.

## Store Submission Requirements

Before App Store or Google Play submission, provide:

- Public privacy policy URL.
- Public terms URL.
- Public support URL.
- No-account explanation in reviewer notes.
- In-app report translation path.
- Data retention and deletion explanation for diagnostics and reports.

## Production Checklist

- Host privacy policy, terms, and support/deletion pages on a stable domain.
- Verify provider retention and training settings.
- Confirm report-triage ownership, escalation, and retention.
- Verify app privacy and Play Data Safety answers match the final implementation.
- Confirm support can handle deletion requests tied to report receipts or anonymous install/session metadata.
