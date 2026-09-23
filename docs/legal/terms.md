# Murmur Terms of Use

Last updated: 2026-09-23

Murmur is a one-way live speech translation app. You choose languages and an available audio source, tap Listen, and Murmur displays translated captions. Microphone mode can play translated speech when available.

## Using Murmur

Use Murmur only where live translation is appropriate and lawful. You are responsible for the speech you provide to the app and for deciding whether translated output is accurate enough for your situation.

Murmur is not intended for emergencies, medical diagnosis, legal advice, immigration advice, financial decisions, or other high-stakes situations where an incorrect translation could cause harm. Verify important translations with a qualified human interpreter.

## AI Translation and Session Insights

Murmur sends the live audio you choose to share through its Cloudflare Worker to OpenAI Realtime for speech recognition and translation. OpenAI may return source captions, translated captions, and translated speech. Output can be delayed, incomplete, inaccurate, offensive, or inappropriate.

AI Session Insights are optional and separate from live translation. Only translated text from a consented session is collected for this feature. For a session with at least 30 seconds of translation, Murmur sends the text to OpenRouter to create a short derived insight, then discards the text without storing it as a transcript. Murmur deletes each insight after 24 months in a daily job or earlier when the associated account is deleted. Turning off insights stops collection for future sessions but does not delete existing insights. The Privacy Policy explains the consent and deletion controls.

You can report translation issues in the app. Reports help support and quality review but do not guarantee that a specific translation will be corrected.

## Accounts, Plans, Credits, and Usage

Murmur creates a guest customer account automatically. A guest can use the available Free allowance and can purchase, restore, and reconcile store purchases without adding an email or creating a registered account. You may save a guest purchase to an account using Apple, Google, or email sign-in; Murmur then links the guest's purchase and remaining balance to that account so they can be recovered on another device. Apple provides your email address and, if you share it with Apple on first sign-in, your name; Murmur stores those details with your account until account deletion. Google provides your email address and, when available, your name and profile image; Murmur stores the profile information Google provides with your account until account deletion.

The app shows the current Free allowance, plan limits, credit value, price, and renewal terms before purchase. Paid allowances and credit packs are subject to the expiry shown in the app; credit packs expire 90 days after purchase. Monthly plans renew each month. Annual plans renew yearly, with allowance timing shown in the app. Unused Free or plan allowances do not roll over.

The applicable app store and a payment and subscription provider handle payment, renewal, cancellation, and applicable taxes. Murmur does not receive or store payment-card details. Deleting a Murmur account does not cancel a store subscription; cancel it through the relevant app store. Refunds can remove granted value and may create a negative balance when refunded time has already been used. A reversed refund restores the corresponding value.

For eligible paid users, Murmur saves committed translated captions in local app storage on the device only; it does not upload this history to the cloud. Deleting a Murmur account does not erase local translation history. You can delete individual history entries or use Delete Local Data to clear on-device data.

If you choose to submit an in-app rating survey, its stars, use-case answer, and optional Other text are sent directly to Murmur's server, not to product analytics, and retained for 24 months. The submission is sent even if Anonymous Analytics is off. Account deletion removes linked responses but does not find anonymous ratings.

## Acceptable Use

Do not use Murmur to:

- Break the law or violate someone else's rights.
- Harass, threaten, abuse, impersonate, or exploit others.
- Generate or distribute hateful, sexual, violent, deceptive, or harmful content.
- Attempt to bypass rate limits, device integrity checks, service safeguards, or security controls.
- Reverse engineer, scrape, overload, or disrupt Murmur or its services.

## Privacy and Third-Party Services

Murmur's privacy practices are described in the Privacy Policy at `https://murmur.q9labs.ai/privacy`. Murmur uses Cloudflare, OpenAI, OpenRouter, PostHog, Sentry, RevenueCat, Apple, Google, and Resend. A configured report webhook may also receive submitted reports. The Privacy Policy describes what each provider receives, including the direct PostHog session-replay connection. Those services may be unavailable or may change independently from Murmur.

## Availability

Murmur may change, suspend, or discontinue features. AI service or cloud infrastructure failures, network conditions, audio or screen-sharing permissions, protected playback, unsupported languages, quotas, or device limitations may prevent live translation or speech output.

## No Warranty

Murmur is provided as-is and as-available. To the maximum extent allowed by law, Murmur disclaims warranties of accuracy, availability, fitness for a particular purpose, and non-infringement.

## Limitation of Liability

To the maximum extent allowed by law, Murmur is not liable for losses caused by translation errors, delays, service interruptions, third-party AI service failures, misuse, or reliance on AI output.

## Changes

These terms may be updated as Murmur, the services it uses, or legal requirements change. The hosted version must include the effective date.

## Contact

Murmur is operated by Q9 Labs. Email `q9labs.ai@gmail.com` for legal or support requests. Public terms URL: `https://murmur.q9labs.ai/terms`.
