# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository. Include reproduction steps, affected versions, impact, and any suggested mitigation.

Do not include live credentials, private user content, signing material, or production access details in the report. Maintainers will acknowledge a complete report as soon as practical and coordinate remediation and disclosure.

## Supported versions

Security fixes are applied to the current default branch. Released mobile builds are updated through their platform stores when a fix affects shipped clients.

## Credential handling

Provider keys belong in Cloudflare secrets or local `.dev.vars`. Mobile signing credentials belong outside the repository. If a credential is committed or shared through an insecure channel, revoke it first, replace it, and purge it from repository history before disclosure.
