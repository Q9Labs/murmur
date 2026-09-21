type Page = {
  description: string;
  html: string;
  keywords?: string;
  path: string;
  title: string;
  isMarketing?: boolean;
};

const lastUpdated = "2026-09-14";
const marketingUpdated = "2026-08-29";
const siteUrl = "https://murmur.q9labs.ai";
const siteName = "Murmur Translate";
const supportEmail = "q9labs.ai@gmail.com";
const appStoreUrl = "https://apps.apple.com/app/id6756962206";
const googlePlayUrl = "https://play.google.com/store/apps/details?id=com.q9labsai.murmur";
const appleLogoSvg = `<svg class="store-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.564 13.02c-.012-2.17 1.77-3.21 1.85-3.26-1.01-1.48-2.58-1.68-3.14-1.7-1.34-.13-2.61.79-3.29.79-.68 0-1.72-.77-2.83-.75-1.46.02-2.8.85-3.55 2.16-1.51 2.62-.39 6.5 1.08 8.63.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.81-.7 1.31 0 1.68.7 2.83.68 1.17-.02 1.91-1.06 2.62-2.11.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.28-.88-2.3-3.48M15.37 6.65c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.22"/></svg>`;
const playLogoSvg = `<svg class="store-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#00D7FE" d="M3.27 2.6a1.2 1.2 0 0 0-.32.86v17.08c0 .35.12.65.33.86l.06.05 9.46-9.46v-.22L3.33 2.55z"/><path fill="#FFC107" d="m16.07 15.06-3.16-3.16v-.22l3.16-3.16.07.04 3.74 2.13c1.07.6 1.07 1.6 0 2.21l-3.81 2.16z"/><path fill="#FF3D49" d="m16.14 15.02-3.23-3.23-9.64 9.64c.35.37.93.42 1.59.05l11.28-6.46"/><path fill="#00F076" d="M16.14 8.56 4.86 2.11C4.2 1.73 3.62 1.78 3.27 2.16l9.64 9.63z"/></svg>`;
const defaultKeywords = [
  "live speech translation app",
  "live voice translator",
  "real-time translated captions",
  "speech translation app",
  "translator app without sign up",
  "one-way live translator",
  "AI speech translation",
  "voice translator with captions",
].join(", ");

type MarketingLandingPageOptions = {
  campaignToken: string;
  description: string;
  examples: string[];
  heading: string;
  keywords: string;
  lede: string;
  useCaseBody: string;
  useCaseTitle: string;
  path: string;
  title: string;
};

function buildMarketingLandingPage(options: MarketingLandingPageOptions): Page {
  const examples = options.examples
    .map((example) => `<li>${escapeHtml(example)}</li>`)
    .join("");
  const campaignToken = options.campaignToken;
  const trackedAppStoreUrl = `${appStoreUrl}?ct=${encodeURIComponent(campaignToken)}&mt=8`;
  const trackedGooglePlayUrl =
    `${googlePlayUrl}&utm_source=murmur-site&utm_campaign=${encodeURIComponent(campaignToken)}`;

  return {
    description: options.description,
    html: `
      <section class="hero">
        <h1>${escapeHtml(options.heading)}</h1>
        <p class="lede">${escapeHtml(options.lede)}</p>
        <div class="hero-actions">
          <a class="store-button store-button-primary" href="${trackedAppStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
          <a class="store-button store-button-secondary" href="${trackedGooglePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
        </div>
        <div class="bloom-stage">
          <span class="bloom" aria-hidden="true"></span>
          <div class="caption-card caption-card-static">
            <p class="cap-translation">Where is the next stop?</p>
            <p class="cap-source" dir="rtl">أين المحطة التالية؟</p>
          </div>
        </div>
      </section>

      <section class="section landing-copy">
        <h2>${escapeHtml(options.useCaseTitle)}</h2>
        <p>${escapeHtml(options.useCaseBody)}</p>
        <ol class="landing-steps">
          <li>Choose the language being spoken.</li>
          <li>Choose the language you want to read.</li>
          <li>Tap Listen to start live translated captions.</li>
        </ol>
      </section>

      <section class="section landing-examples">
        <h2>Use live captions when you need to keep listening.</h2>
        <ul>${examples}</ul>
      </section>

      <section class="section values">
        <div class="value">
          <h3>Captions first</h3>
          <p>Readable translated text remains useful when speech output is unavailable.</p>
        </div>
        <div class="value">
          <h3>No event setup</h3>
          <p>Start from your own phone without waiting for an organizer or host to configure a feed.</p>
        </div>
        <div class="value">
          <h3>Know the limits</h3>
          <p>AI output can be delayed, incomplete, or inaccurate. Use a qualified human interpreter for high-stakes decisions.</p>
        </div>
      </section>

      <section class="cta">
        <span class="bloom" aria-hidden="true"></span>
        <h2>Follow spoken language through live captions.</h2>
        <div class="hero-actions">
          <a class="store-button store-button-primary" href="${appStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
          <a class="store-button store-button-secondary" href="${googlePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
        </div>
      </section>
    `,
    isMarketing: true,
    keywords: options.keywords,
    path: options.path,
    title: options.title,
  };
}

export const legalPages: Record<string, Page> = {
  "/": {
    isMarketing: true,
    path: "/",
    title: "Murmur | Live Translated Captions for Tours and Talks",
    description:
      "Follow tours, talks, lectures, and conferences in another language with live translated captions. Start with 30 free minutes and no cloud transcript history by default.",
    keywords: defaultKeywords,
    html: `
      <section class="hero">
        <h1>Follow every word, in your language.</h1>
        <p class="lede">Murmur turns a guide, speaker, or lecturer into live translated captions on your phone.</p>
        <div class="hero-actions">
          <a class="store-button store-button-primary" href="${appStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
          <a class="store-button store-button-secondary" href="${googlePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
        </div>
        <div class="bloom-stage">
          <span class="bloom" aria-hidden="true"></span>
          <div class="caption-card">
            <div class="cap-stack">
              <div class="cap-slide cap-1"><p class="cap-translation" dir="rtl">أين محطة القطار؟</p><p class="cap-source">Where is the train station?</p></div>
              <div class="cap-slide cap-2"><p class="cap-translation">&iquest;D&oacute;nde est&aacute; la estaci&oacute;n de tren?</p><p class="cap-source">Where is the train station?</p></div>
              <div class="cap-slide cap-3"><p class="cap-translation">&#38651;&#36554;&#12398;&#39365;&#12399;&#12393;&#12371;&#12391;&#12377;&#12363;&#65311;</p><p class="cap-source">Where is the train station?</p></div>
            </div>
            <div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>From spoken words to readable captions.</h2>
        <div class="steps">
          <div class="step">
            <div class="stage stage-coral">
              <div class="pick"><span class="pill">English</span><span class="pick-arrow">&rarr;</span><span class="pill pill-alt">Arabic</span></div>
            </div>
            <h3>Pick a direction</h3>
            <p>Choose the language you&rsquo;ll hear and the one you want to read.</p>
          </div>
          <div class="step">
            <div class="stage stage-teal">
              <span class="mic-pulse"></span><span class="mic-pulse"></span>
              <div class="mic-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg></div>
            </div>
            <h3>Tap Listen</h3>
            <p>Murmur captures only the audio source you choose while a session is live.</p>
          </div>
          <div class="step">
            <div class="stage stage-violet">
              <div class="caption-demo"><span class="cap-line">&iquest;D&oacute;nde est&aacute; la estaci&oacute;n?</span><span class="cap-line">Where is the station?</span></div>
            </div>
            <h3>Read along</h3>
            <p>Translated captions appear as each part of the speech is recognized.</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>For quick moments and full talks.</h2>
        <div class="use-case-links">
          <a class="use-case-link" href="/live-translation-for-travel">
            <strong>Read along with a guide.</strong>
            <span>Follow explanations, directions, and short conversations without passing the phone back and forth.</span>
          </a>
          <a class="use-case-link" href="/live-translation-for-talks">
            <strong>Keep up while the speaker continues.</strong>
            <span>A rolling caption timeline for lectures, workshops, demonstrations, and conference talks.</span>
          </a>
        </div>
      </section>

      <section class="section values">
        <div class="value">
          <h3>Captions first</h3>
          <p>Clear, readable text &mdash; even when spoken output isn&rsquo;t available.</p>
        </div>
        <div class="value">
          <h3>Guest first</h3>
          <p>Start without sign-up. Add an email only so purchases can be recovered across devices.</p>
        </div>
        <div class="value">
          <h3>Yours alone</h3>
          <p>No audio or transcript history saved by default.</p>
        </div>
      </section>

      <section class="section" id="pricing">
        <h2>Start free. Add time when you need it.</h2>
        <div class="price-grid">
          <article class="price-card">
            <h3>Free</h3>
            <p class="price">$0</p>
            <p>30 minutes every month.</p>
          </article>
          <article class="price-card price-card-featured">
            <h3>Murmur Pro</h3>
            <p class="price">$12.99 <span>/ month</span></p>
            <p>3 hours every month, or $124.99 yearly.</p>
          </article>
          <article class="price-card">
            <h3>Credit packs</h3>
            <p class="price">From $3.99</p>
            <p>60, 180, or 540 minutes that never expire.</p>
          </article>
        </div>
        <p class="pricing-note">Purchases use Apple App Store or Google Play billing. Taxes and localized prices can vary by storefront.</p>
      </section>

      <section class="cta">
        <span class="bloom" aria-hidden="true"></span>
        <h2>Take Murmur to your next tour or talk.</h2>
        <div class="hero-actions">
          <a class="store-button store-button-primary" href="${appStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
          <a class="store-button store-button-secondary" href="${googlePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
        </div>
      </section>
    `,
  },
  "/live-translation-for-travel": buildMarketingLandingPage({
    campaignToken: "travel",
    path: "/live-translation-for-travel",
    title: "Live Translation for Travel and Tours | Murmur",
    description:
      "Follow guides and spoken explanations in another language with live translated captions on your phone. Start with 30 free minutes each month.",
    keywords: "live translation for travel, tour guide translator, travel voice translator, live captions for tours",
    heading: "Understand the guide without interrupting the tour.",
    lede:
      "Choose the language you hear and the language you want to read. Murmur turns the guide's speech into live translated captions while the tour keeps moving.",
    useCaseTitle: "Live captions for quick questions and full explanations.",
    useCaseBody:
      "Use Murmur for a direction or short question, then keep live translated captions moving when a guide, host, or demonstrator speaks for longer.",
    examples: [
      "Walking tours and museum explanations",
      "Hotel, transport, and visitor information",
      "Demonstrations, tastings, and guided experiences",
    ],
  }),
  "/live-translation-for-talks": buildMarketingLandingPage({
    campaignToken: "talks",
    path: "/live-translation-for-talks",
    title: "Live Translation for Talks, Lectures, and Conferences | Murmur",
    description:
      "Read live translated captions while a lecturer, workshop host, or conference speaker continues talking. No event setup is required.",
    keywords: "conference speech translator, live translation for lectures, translated captions for talks, event voice translator",
    heading: "Read the talk live on your own phone.",
    lede:
      "Murmur is for the attendee who needs translated captions now. Select the spoken and reading languages, tap Listen, and follow the speaker without an event code or organizer-managed feed.",
    useCaseTitle: "A rolling timeline for ongoing speech.",
    useCaseBody:
      "Committed captions stay on screen as the talk progresses. Use the same live session for questions, introductions, and shorter exchanges.",
    examples: [
      "Conference talks and community stages",
      "Lectures, classes, workshops, and sermons",
      "Product demonstrations and guided presentations",
    ],
  }),
  "/english-to-arabic-live-captions": buildMarketingLandingPage({
    campaignToken: "english-arabic",
    path: "/english-to-arabic-live-captions",
    title: "English to Arabic Live Captions | Murmur",
    description:
      "Turn spoken English into live Arabic captions for tours, talks, lectures, and short phrases with Murmur.",
    keywords: "English to Arabic live captions, English Arabic voice translator, live English Arabic translation",
    heading: "Hear English. Read Arabic live.",
    lede:
      "Set English as the spoken language and Arabic as the caption language. Murmur displays right-to-left translated captions as stable speech is recognized.",
    useCaseTitle: "Captions that fit the speaker.",
    useCaseBody:
      "Murmur handles a short sentence or a longer explanation, keeping translated captions readable as speech is recognized.",
    examples: [
      "English-language tours and visitor experiences",
      "Talks, lectures, workshops, and demonstrations",
      "Short spoken instructions and explanations",
    ],
  }),
  "/arabic-to-english-live-captions": buildMarketingLandingPage({
    campaignToken: "arabic-english",
    path: "/arabic-to-english-live-captions",
    title: "Arabic to English Live Captions | Murmur",
    description:
      "Turn spoken Arabic into live English captions for tours, talks, lectures, and short phrases with Murmur.",
    keywords: "Arabic to English live captions, Arabic English voice translator, live Arabic English translation",
    heading: "Hear Arabic. Read English live.",
    lede:
      "Set Arabic as the spoken language and English as the caption language. Murmur turns stable speech into readable translated captions on your phone.",
    useCaseTitle: "Follow a question or a full explanation.",
    useCaseBody:
      "Murmur handles a short sentence or a longer explanation, so you can keep translated captions on screen through tours, talks, lectures, and demonstrations.",
    examples: [
      "Arabic-speaking guides and hosts",
      "Talks, workshops, lectures, and sermons",
      "Visitor information and short explanations",
    ],
  }),
  "/privacy": {
    description: "Murmur privacy policy for live translation, accounts, and in-app purchases.",
    path: "/privacy",
    title: "Murmur Privacy Policy",
    html: `
      <h1>Murmur Privacy Policy</h1>
      <p><strong>Last updated:</strong> ${lastUpdated}</p>
      <p>Murmur is a one-way live translator. You choose languages and an available audio source, tap Listen, and Murmur shows translated captions. Microphone mode can play translated phrases when available.</p>
      <p>Before a live translation session starts, Murmur asks for permission to share the selected live audio with OpenAI Realtime through Murmur's Cloudflare Worker. The app does not open an OpenAI Realtime connection or capture audio until this permission is granted.</p>
      <h2>Data Murmur Processes</h2>
      <p><strong>Live audio.</strong> In Microphone mode, Murmur collects microphone audio only during a user-started live session. On supported Android phones, Phone audio mode captures eligible media playback after the user approves Android's audio-recording and screen-sharing prompts; Murmur does not record the microphone in this mode. Audio passes through Murmur's Cloudflare Worker to OpenAI Realtime. Murmur does not save captured audio by default.</p>
      <p><strong>Floating captions.</strong> In Android Phone audio mode, translated captions can appear in a draggable system overlay after the user allows Murmur to display over other apps. The overlay is rendered locally and does not add another server copy of captions.</p>
      <p><strong>Source and translated captions.</strong> OpenAI Realtime returns source-language and translated captions through Murmur's Cloudflare Worker for local display. Murmur does not save transcript history by default.</p>

      <p><strong>Account, entitlement, and purchase metadata.</strong> Murmur creates a random guest customer id so it can grant Free time and meter translation use. You can add an email address for account recovery; Murmur stores the email and sign-in records needed for that purpose. Murmur stores plan state, credit grants, usage debits, renewals, restores, refunds, and store transaction identifiers in an append-only entitlement ledger. Apple, Google, and RevenueCat process store purchases. Murmur does not receive or store your payment-card details.</p>
      <p><strong>Anonymous install, Free allowance, and session metadata.</strong> The app creates an anonymous install identifier and a separate Free allowance identifier in platform secure storage. The Worker hashes both values. The install identifier supports diagnostics and pseudonymous session measurement; the Free allowance identifier prevents account deletion from creating more than one 30-minute grant for the same app installation in a UTC month. Reset Murmur Identity replaces only the diagnostic install identifier. Delete Local Data removes both local identifiers, while the current monthly Free claim hash can remain on the server through its allowance period for abuse prevention.</p>
      <p><strong>Campaign and referral tags.</strong> When Murmur is opened directly through a tagged app link, it may process a short allowlisted source, medium, campaign, content, partner, or landing-page label with the next successful live session. These labels are normalized, length-limited, and consumed after that session starts. Store-page links use Apple or Google campaign parameters measured by the respective store; Murmur does not currently copy iOS install attribution into an in-app session. Murmur does not put audio or caption text in campaign attribution.</p>
      <p><strong>Local engagement state.</strong> Murmur stores a qualified-session count and the version and time of its last native rating request on the device. This state is used only to avoid interrupting a live or unsuccessful session and to avoid repeatedly asking for a rating. It contains no audio or caption text.</p>
      <p><strong>Translation reports.</strong> You can report inaccurate, wrong-language, harmful, speech-related, or other translation issues. Reports include session/span metadata and may include text snapshots only when explicitly submitted by the app.</p>
      <p><strong>Product analytics, diagnostics, and latency telemetry.</strong> Murmur uses anonymous product analytics to measure activation, translation completion and issue-report categories, latency, return use, and failures. Events can include app and build version, platform, language pair, broad network type, feature settings, timing, duration, error category, audio byte or frame counts, caption character counts, and whether a committed translation occurred. They never include captured audio, source captions, translated captions, generated speech audio, advertising identifiers, precise location, contacts, or account data.</p>
      <p>The app sends analytics events to Murmur's Cloudflare Worker. The Worker validates a fixed event schema, hashes the anonymous install identifier, and forwards the allowed event properties to PostHog US. PostHog does not receive the raw install identifier or the device's IP address from Murmur. Murmur disables PostHog person profiles, geolocation, autocapture, and session replay.</p>
      <p>Murmur uses Sentry for crash, error, and sampled performance monitoring. Murmur disables screenshots, view hierarchy capture, session replay, request bodies, cookies, query strings, user fields, and default personally identifiable information. Sentry may receive a sanitized stack trace, operation and error categories, release, environment, app session identifier, and limited performance timing. Sentry does not receive conversation content from Murmur.</p>
      <h2>Third-Party Processors</h2>
      <p>Murmur uses Cloudflare for the Worker gateway, account database, entitlement ledger, and rate limits; OpenAI Realtime for live transcription and translation; RevenueCat for Apple and Google purchase validation and lifecycle events; Resend for email sign-in codes; PostHog US for anonymous product analytics; and Sentry for sanitized error and performance monitoring. Murmur requires third-party processors that handle user data for Murmur to provide the same or equal protection for that data as described in this policy and required by applicable store privacy rules.</p>
      <h2>Retention</h2>
      <p>Murmur does not retain audio, transcript history, or translated caption history by default. Account records remain until account deletion. A hashed Free allowance claim can remain through the applicable UTC month after deletion so a replacement guest account cannot mint another grant. Entitlement, store transaction, usage, renewal, and refund ledger records are retained as needed for service integrity, fraud prevention, financial reconciliation, and legal obligations, with direct identifiers removed when the account is deleted. Analytics, diagnostics, campaign, and rate-limit metadata is retained only as needed for product measurement, abuse prevention, debugging, and service operation, then deleted or anonymized under Murmur's provider retention settings.</p>
      <h2>Your Choices</h2>
      <ul>
        <li>Stop or cancel a live session at any time.</li>
        <li>Use translated captions even when speech output is unavailable.</li>
        <li>Turn Anonymous Analytics off or on in Settings. Analytics is on by default until you turn it off. Turning it off stops new PostHog product analytics events; essential sanitized crash and error monitoring can continue.</li>
        <li>Reset Murmur Identity in the app.</li>
        <li>Delete Local Data in the app.</li>
        <li>Delete your Murmur account and sign-in data in Account &amp; billing. Store subscriptions must be cancelled separately.</li>
        <li>Contact support to request deletion of server-side diagnostics or report records tied to a report receipt or anonymous install/session metadata.</li>
      </ul>
      <h2>Children</h2>
      <p>Murmur V1 is not designed for children and is not intended for the Kids Category or Designed for Families.</p>
      <h2>Contact</h2>
      <p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> for privacy, deletion, or support requests.</p>
    `,
  },
  "/terms": {
    description: "Murmur terms of use.",
    path: "/terms",
    title: "Murmur Terms of Use",
    html: `
      <h1>Murmur Terms of Use</h1>
      <p><strong>Last updated:</strong> ${lastUpdated}</p>
      <p>Murmur is a one-way live translation app. You choose languages and an available audio source, tap Listen, and Murmur shows translated captions. Optional speech output may play translated phrases in Microphone mode when available.</p>
      <h2>Using Murmur</h2>
      <p>Use Murmur only where live translation is appropriate and lawful. You are responsible for the speech you provide to the app and for deciding whether translated output is accurate enough for your situation.</p>
      <p>Murmur is not intended for emergencies, medical diagnosis, legal advice, immigration advice, financial decisions, or other high-stakes situations where an incorrect translation could cause harm. Always verify important translations with a qualified human interpreter.</p>
      <h2>AI Translation Limits</h2>
      <p>OpenAI Realtime handles speech recognition, translation, and translated speech. Its output can be delayed, incomplete, inaccurate, offensive, or inappropriate. Murmur may show captions when speech output is unavailable.</p>
      <p>You can report translation issues in the app. Reports help support and quality review, but they do not guarantee that a specific translation will be corrected.</p>
      <h2>Accounts, Plans, Credits, and Usage</h2>
      <p>Murmur starts with a guest customer account and 30 Free minutes each month. Add and verify an email before you subscribe to Murmur Pro or buy a non-expiring credit pack, so paid value can be recovered on another device. Pro provides a 3-hour monthly allowance. Allowance time is used before credit packs. The app shows store-localized prices before purchase.</p>
      <p>Monthly Pro renews each month. Annual Pro provides the same 3-hour allowance each internal month for one yearly charge. It does not grant the full year of time at once. Unused Free or Pro allowance expires at the end of its allowance period and does not roll over. Credit packs do not expire.</p>
      <p>Apple or Google handles payment, renewal, cancellation, and applicable taxes. Deleting a Murmur account does not cancel a store subscription. Cancel it in the App Store or Google Play. Refunds can remove granted value and may create a negative balance when refunded time was already used. A reversed refund restores the corresponding value.</p>
      <h2>Acceptable Use</h2>
      <ul>
        <li>Do not break the law or violate someone else's rights.</li>
        <li>Do not harass, threaten, abuse, impersonate, or exploit others.</li>
        <li>Do not generate or distribute hateful, sexual, violent, deceptive, or harmful content.</li>
        <li>Do not attempt to bypass rate limits, device integrity checks, service safeguards, or security controls.</li>
        <li>Do not reverse engineer, scrape, overload, or disrupt Murmur or its services.</li>
        <li>Do not attempt to access administrative endpoints or private diagnostics data.</li>
      </ul>
      <h2>Privacy and Third-Party Services</h2>
      <p>Murmur's privacy practices are described in the Murmur Privacy Policy. Murmur relies on Cloudflare and OpenAI Realtime for live translation, infrastructure, diagnostics, and support workflows. OpenAI Realtime or Cloudflare may be unavailable or may change independently from Murmur.</p>
      <h2>Availability</h2>
      <p>Murmur may change, suspend, or discontinue features. OpenAI Realtime or Cloudflare failures, network conditions, audio or screen-sharing permissions, protected playback, unsupported languages, quotas, or device limitations may prevent live translation or speech output.</p>
      <h2>No Warranty</h2>
      <p>Murmur is provided as-is and as-available. To the maximum extent allowed by law, Murmur disclaims warranties of accuracy, availability, fitness for a particular purpose, and non-infringement.</p>
      <h2>Limitation of Liability</h2>
      <p>To the maximum extent allowed by law, Murmur is not liable for losses caused by translation errors, delays, service interruptions, OpenAI Realtime failures, misuse, or reliance on AI output.</p>
      <h2>Contact</h2>
      <p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> for legal or support requests.</p>
    `,
  },
  "/support": {
    description: "Murmur support and deletion information.",
    path: "/support",
    title: "Murmur Support and Deletion",
    html: `
      <h1>Murmur Support and Deletion</h1>
      <p><strong>Last updated:</strong> ${lastUpdated}</p>
      <h2>Support Contact</h2>
      <p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> for support, safety issues, privacy questions, and deletion requests. Include your report receipt id if your request relates to a translation report.</p>
      <h2>Accounts and Deletion</h2>
      <p>Murmur creates a random guest customer account when you first use the app. You can add email recovery from Account &amp; billing. Murmur has no cloud transcript history.</p>
      <p>Use <strong>Delete Murmur account</strong> in Account &amp; billing to remove sign-in data and access to the remaining balance. This does not cancel an Apple or Google subscription; cancel it through the store first. Murmur retains a pseudonymous financial and entitlement record only when needed for refunds, fraud prevention, reconciliation, and legal obligations.</p>
      <p>The app stores anonymous install and Free allowance identifiers, interface preference, and rating-prompt eligibility state on the device. Use <strong>Reset Murmur Identity</strong> to replace the diagnostic install identifier without changing billing, or <strong>Delete Local Data</strong> to clear all local Murmur data and the privacy acknowledgement. The hashed current-month Free claim can remain on the server through that month for abuse prevention.</p>
      <h2>Server-Side Deletion Requests</h2>
      <p>Murmur may process rate-limit metadata, diagnostic records, and translation report receipts. Support can review deletion requests for records that can reasonably be tied to a user-supplied receipt or anonymous install/session metadata.</p>
      <p>Support will not ask users to send audio recordings, full transcripts, government IDs, passwords, private keys, or app store credentials.</p>
      <h2>Report Translation Triage</h2>
      <p>Murmur's in-app report categories are inaccurate, wrong language, harmful or offensive, speech issue, and other.</p>
      <h2>Store Submission Notes</h2>
      <p>Store reviewers can start with the automatic guest account and Free allowance. Tap Listen, speak naturally, review translated captions, then verify an email in Account &amp; billing before testing purchase and Restore controls. Use the report buttons on a committed translation span.</p>
    `,
  },
};

export function renderLegalPage(pathname: string): Response | null {
  if (pathname === "/favicon.svg") {
    return new Response(renderFaviconSvg(), {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": "image/svg+xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (pathname === "/robots.txt") {
    return new Response(renderRobotsTxt(), {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (pathname === "/sitemap.xml") {
    return new Response(renderSitemapXml(), {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const page = legalPages[pathname];
  if (!page) {
    return null;
  }

  return new Response(renderHtml(page), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function renderHtml(page: Page): string {
  const canonicalUrl = canonicalFor(page.path);
  const socialTitle = page.title;
  const socialDescription = page.description;
  const jsonLd = renderJsonLd(page, canonicalUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(page.description)}">
    <meta name="keywords" content="${escapeHtml(page.keywords ?? defaultKeywords)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${siteName}">
    <meta property="og:title" content="${escapeHtml(socialTitle)}">
    <meta property="og:description" content="${escapeHtml(socialDescription)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(socialTitle)}">
    <meta name="twitter:description" content="${escapeHtml(socialDescription)}">
    <title>${escapeHtml(page.title)}</title>
    ${jsonLd}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --canvas: #FDF9F5;
        --surface: #FFFFFF;
        --line: #EFE7DF;
        --ink: #1A1033;
        --ink-soft: #5E5873;
        --coral: #FF5A4E;
        --teal: #2FC4BF;
        --yellow: #FFB43B;
        --violet: #8768E0;
        --font-main: "Outfit", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        background: var(--canvas);
        color: var(--ink);
        font-family: var(--font-main);
        font-size: 1.0625rem;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
      }
      h1, h2, h3, p { margin: 0; }
      a:focus-visible { outline: 2px solid var(--coral); outline-offset: 3px; border-radius: 6px; }

      .container { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

      header {
        padding: 22px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .logo-link {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--ink);
        font-weight: 600;
        font-size: 1.2rem;
        letter-spacing: -0.01em;
      }
      .logo-link svg { border-radius: 9px; flex: 0 0 auto; }
      nav { display: flex; gap: 24px; }
      nav a { text-decoration: none; color: var(--ink-soft); font-size: 0.95rem; transition: color 0.2s; }
      nav a:hover { color: var(--ink); }
      @media (max-width: 520px) { nav { gap: 16px; } nav a { font-size: 0.88rem; } }

      main { padding-bottom: 96px; }

      /* Bloom: the soft four-color glow from the app's brand direction */
      .bloom {
        position: absolute;
        inset: 0;
        pointer-events: none;
        filter: blur(56px);
        opacity: 0.55;
        background:
          radial-gradient(38% 46% at 28% 30%, var(--coral), transparent 70%),
          radial-gradient(36% 44% at 74% 34%, var(--teal), transparent 70%),
          radial-gradient(34% 42% at 66% 78%, var(--yellow), transparent 70%),
          radial-gradient(38% 46% at 30% 76%, var(--violet), transparent 70%);
        animation: drift 14s ease-in-out infinite alternate;
      }
      @keyframes drift {
        from { transform: rotate(0deg) scale(1); }
        to { transform: rotate(14deg) scale(1.08); }
      }

      /* Hero */
      .hero { padding-top: clamp(48px, 9vw, 104px); text-align: center; }
      .hero h1 {
        font-size: clamp(2.7rem, 7.4vw, 5rem);
        font-weight: 600;
        line-height: 1.02;
        letter-spacing: -0.035em;
        max-width: 14ch;
        margin: 0 auto;
        text-wrap: balance;
      }
      .lede {
        color: var(--ink-soft);
        font-size: clamp(1.1rem, 2.2vw, 1.3rem);
        max-width: 34em;
        margin: 24px auto 0;
        text-wrap: balance;
      }
      .hero-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 36px; }

      .store-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 54px;
        padding: 0 26px;
        border-radius: 18px;
        text-decoration: none;
        font-weight: 600;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .store-button:hover { transform: translateY(-2px); }
      .store-logo { width: 21px; height: 21px; flex: 0 0 auto; }
      .store-button-primary { background: var(--coral); color: #FFFFFF; box-shadow: 0 10px 24px rgba(255, 90, 78, 0.28); }
      .store-button-primary:hover { box-shadow: 0 14px 30px rgba(255, 90, 78, 0.34); }
      .store-button-secondary { background: var(--surface); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line), 0 8px 20px rgba(26, 16, 51, 0.06); }

      .bloom-stage {
        position: relative;
        max-width: 640px;
        margin: clamp(56px, 8vw, 88px) auto 0;
        padding: clamp(28px, 6vw, 64px) 0;
      }
      .caption-card {
        position: relative;
        background: rgba(255, 255, 255, 0.86);
        -webkit-backdrop-filter: blur(18px);
        backdrop-filter: blur(18px);
        border: 1px solid rgba(255, 255, 255, 0.9);
        border-radius: 32px;
        padding: clamp(28px, 5vw, 44px);
        box-shadow: 0 30px 70px rgba(26, 16, 51, 0.12);
      }
      .cap-stack { position: relative; min-height: 150px; }
      .cap-slide {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 12px;
        opacity: 0;
        animation: capcycle 10.5s ease-in-out infinite;
      }
      .cap-2 { animation-delay: 3.5s; }
      .cap-3 { animation-delay: 7s; }
      @keyframes capcycle {
        0% { opacity: 0; transform: translateY(10px); }
        5%, 29% { opacity: 1; transform: translateY(0); }
        33.3%, 100% { opacity: 0; transform: translateY(-10px); }
      }
      .cap-translation { font-size: clamp(1.7rem, 4.6vw, 2.5rem); font-weight: 600; line-height: 1.18; letter-spacing: -0.02em; }
      .cap-source { color: var(--ink-soft); font-size: 1.05rem; }
      .caption-card-static { display: grid; gap: 12px; }

      .eq { display: flex; align-items: center; justify-content: center; gap: 6px; height: 30px; margin-top: 20px; }
      .eq i { width: 5px; height: 100%; border-radius: 999px; background: var(--coral); animation: eq 1.2s ease-in-out infinite; }
      .eq i:nth-child(4n + 2) { background: var(--teal); animation-delay: -0.9s; }
      .eq i:nth-child(4n + 3) { background: var(--yellow); animation-delay: -0.5s; }
      .eq i:nth-child(4n) { background: var(--violet); animation-delay: -0.25s; }
      @keyframes eq { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }

      /* Sections */
      .section { padding-top: clamp(88px, 12vw, 144px); }
      .section > h2, .cta h2 {
        font-size: clamp(2rem, 4.8vw, 3.1rem);
        font-weight: 600;
        line-height: 1.06;
        letter-spacing: -0.03em;
        max-width: 18ch;
        margin-bottom: clamp(36px, 5vw, 56px);
        text-wrap: balance;
      }

      .steps, .values, .price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
      @media (max-width: 800px) { .steps, .values, .price-grid { grid-template-columns: 1fr; } }

      .stage { aspect-ratio: 5 / 4; border-radius: 28px; display: grid; place-items: center; overflow: hidden; }
      .stage > * { grid-area: 1 / 1; }
      .stage-coral { background: #FFE9E4; }
      .stage-teal { background: #DDF5F3; }
      .stage-violet { background: #ECE6FB; }
      @media (max-width: 800px) { .stage { aspect-ratio: 16 / 9; } }
      .step h3, .value h3, .price-card h3 { font-size: 1.3rem; font-weight: 600; letter-spacing: -0.01em; }
      .step h3 { margin: 24px 0 6px; }
      .step p, .value p { color: var(--ink-soft); }

      .pick { display: flex; align-items: center; gap: 12px; }
      .pill { background: var(--surface); color: var(--ink); font-weight: 600; padding: 12px 20px; border-radius: 999px; box-shadow: 0 8px 18px rgba(26, 16, 51, 0.08); }
      .pill-alt { background: var(--ink); color: #FFFFFF; }
      .pick-arrow { color: var(--coral); font-size: 1.3rem; animation: nudge 1.6s ease-in-out infinite; }
      @keyframes nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }

      .mic-btn { width: 84px; height: 84px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; color: var(--ink); box-shadow: 0 12px 26px rgba(26, 16, 51, 0.14); z-index: 1; }
      .mic-btn svg { width: 32px; height: 32px; }
      .mic-pulse { width: 84px; height: 84px; border-radius: 50%; background: var(--teal); opacity: 0; animation: pulse-ring 2.4s ease-out infinite; }
      .mic-pulse:nth-child(2) { animation-delay: 1.2s; }
      @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.45; } 100% { transform: scale(2); opacity: 0; } }

      .caption-demo { width: 78%; display: grid; gap: 10px; }
      .cap-line {
        background: var(--surface);
        border-radius: 16px 16px 16px 5px;
        padding: 11px 16px;
        font-weight: 500;
        font-size: 0.95rem;
        box-shadow: 0 8px 18px rgba(26, 16, 51, 0.08);
        opacity: 0;
        animation: rise 4s ease-in-out infinite;
      }
      .cap-line:nth-child(2) { animation-delay: 2s; }
      @keyframes rise {
        0% { opacity: 0; transform: translateY(10px); }
        14%, 72% { opacity: 1; transform: translateY(0); }
        92%, 100% { opacity: 0; transform: translateY(-6px); }
      }

      .use-case-links { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
      @media (max-width: 800px) { .use-case-links { grid-template-columns: 1fr; } }
      .use-case-link, .value, .price-card, .landing-examples li {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 32px;
      }
      .use-case-link {
        min-height: 190px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 10px;
        color: var(--ink);
        text-decoration: none;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .use-case-link:hover { transform: translateY(-3px); box-shadow: 0 22px 44px rgba(26, 16, 51, 0.09); }
      .use-case-link strong { font-size: clamp(1.5rem, 3vw, 1.9rem); font-weight: 600; line-height: 1.12; letter-spacing: -0.02em; }
      .use-case-link span { color: var(--ink-soft); max-width: 30em; }

      .value { display: grid; gap: 8px; align-content: start; }

      .price-card { display: grid; gap: 6px; align-content: start; }
      .price-card p:last-child { color: var(--ink-soft); }
      .price { font-size: 2.3rem; font-weight: 600; letter-spacing: -0.03em; margin: 10px 0 6px; }
      .price span { font-size: 1rem; font-weight: 400; letter-spacing: 0; color: var(--ink-soft); }
      .price-card-featured { background: var(--ink); border-color: var(--ink); color: #FFFFFF; }
      .price-card-featured p:last-child, .price-card-featured .price span { color: #C9C3DB; }
      .pricing-note { color: var(--ink-soft); font-size: 0.9rem; margin-top: 24px; }

      /* Use-case landing pages */
      .landing-copy > p { color: var(--ink-soft); font-size: 1.15rem; max-width: 40em; margin-top: -24px; }
      .landing-steps { margin: 28px 0 0; padding-left: 22px; font-weight: 500; line-height: 2; }
      .landing-examples ul { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; list-style: none; margin: 0; padding: 0; }
      @media (max-width: 800px) { .landing-examples ul { grid-template-columns: 1fr; } }
      .landing-examples li { font-weight: 500; }

      /* Closing CTA */
      .cta {
        position: relative;
        margin-top: clamp(88px, 12vw, 144px);
        padding: clamp(72px, 11vw, 128px) 24px;
        text-align: center;
      }
      .cta h2 { position: relative; margin: 0 auto; }
      .cta .hero-actions { position: relative; }
      .cta .bloom { inset: 10% 12%; opacity: 0.42; }

      @media (prefers-reduced-motion: reduce) {
        html { scroll-behavior: auto; }
        *, *::before, *::after { animation: none !important; transition: none !important; }
        .cap-line, .cap-slide.cap-1 { opacity: 1; }
        .eq i { transform: scaleY(0.6); }
      }

      /* Legal Styles */
      .legal-content { max-width: 720px; margin: 56px auto 0; line-height: 1.65; }
      .legal-content h1 { font-size: clamp(2.2rem, 5vw, 3rem); font-weight: 600; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 24px; }
      .legal-content h2 { font-size: 1.45rem; font-weight: 600; letter-spacing: -0.01em; margin: 48px 0 12px; }
      .legal-content p, .legal-content li { color: #3F3A52; margin: 0 0 16px; }
      .legal-content ul { padding-left: 20px; }
      .legal-content a { color: var(--ink); font-weight: 500; text-underline-offset: 3px; }

      footer {
        padding: 40px 0 56px;
        border-top: 1px solid var(--line);
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 16px 32px;
        font-size: 0.92rem;
        color: var(--ink-soft);
      }
      .footer-links { display: flex; flex-wrap: wrap; gap: 8px 22px; }
      .footer-links a { color: var(--ink-soft); text-decoration: none; transition: color 0.2s; }
      .footer-links a:hover { color: var(--ink); }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <a href="/" class="logo-link">
          ${renderHeaderLogoSvg()}
          <span>Murmur</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/#pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
        </nav>
      </header>

      <main>
        ${page.isMarketing ? page.html : `<div class="legal-content">${page.html}</div>`}
      </main>

      <footer>
        <div class="footer-links" aria-label="Murmur use cases">
          <a href="/live-translation-for-travel">Travel translation</a>
          <a href="/live-translation-for-talks">Talk translation</a>
          <a href="/english-to-arabic-live-captions">English to Arabic</a>
          <a href="/arabic-to-english-live-captions">Arabic to English</a>
        </div>
        <span>&copy; 2026 Q9 Labs</span>
      </footer>
    </div>
  </body>
</html>`;
}

function canonicalFor(path: string): string {
  return `${siteUrl}${path === "/" ? "/" : path}`;
}

function renderHeaderLogoSvg(): string {
  return renderLogoSvg(32, 32);
}

function renderFaviconSvg(): string {
  return renderLogoSvg(64, 64);
}

function renderLogoSvg(width: number, height: number): string {
  return `<svg width="${width}" height="${height}" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" rx="200" fill="#F8F4ED"/>
    <path d="M286 424c18-116 122-198 238-190 88 6 139 64 190 114 34 33 72 45 111 27 20-9 43 5 49 27 17 62 13 132-15 193-46 101-147 165-260 165H464c-117 0-216-85-234-201-8-51 13-103 56-135z" fill="#FF6B4A"/>
    <path d="M245 523c61-85 154-106 226-53 66 48 135 57 199 7 82-65 151-90 244-42 10 112-66 236-197 282H454c-112 0-203-79-209-194z" fill="#21C7C2"/>
    <path d="M337 624c71-48 127-38 188 18 48 44 101 55 156 11 83-67 157-57 236 10-45 78-126 128-218 128H449c-57 0-94-70-112-167z" fill="#FFD166"/>
    <path d="M352 738c73-51 149-25 209 43 51 58 106 65 167 20 42-31 84-42 128-33-43 76-125 126-217 126H517l-82 82c-21 21-56 4-52-25l15-96c-31-22-47-58-46-117z" fill="#8C66EE"/>
  </svg>`;
}

function renderRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function renderSitemapXml(): string {
  const urls = Object.values(legalPages).map((page) => {
    const lastmod = page.isMarketing ? marketingUpdated : lastUpdated;
    return `  <url>
    <loc>${canonicalFor(page.path)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

function renderJsonLd(page: Page, canonicalUrl: string): string {
  const organizationId = `${siteUrl}/#organization`;
  const graph = page.isMarketing
    ? [
        {
          "@id": organizationId,
          "@type": "Organization",
          email: supportEmail,
          name: "Q9 Labs",
          url: siteUrl,
        },
        {
          "@id": `${siteUrl}/#website`,
          "@type": "WebSite",
          inLanguage: "en-US",
          name: siteName,
          publisher: { "@id": organizationId },
          url: siteUrl,
        },
        {
          "@id": `${siteUrl}/#app`,
          "@type": "SoftwareApplication",
          applicationCategory: "UtilitiesApplication",
          description:
            "One-way live speech translation with real-time translated captions, 30 free minutes each month, optional paid time, and no cloud transcript history by default.",
          featureList: [
            "One-way live speech translation",
            "Real-time translated captions",
            "Optional translated speech",
            "Automatic guest account with optional email recovery",
            "30 free minutes each month",
            "No cloud transcript history by default",
          ],
          name: siteName,
          operatingSystem: "iOS, Android",
          privacyPolicy: `${siteUrl}/privacy`,
          publisher: { "@id": organizationId },
          url: siteUrl,
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Does Murmur require an account?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Murmur creates a guest account automatically. Email is optional for Free use and is required before purchase so plans and credits can be recovered across devices.",
              },
            },
            {
              "@type": "Question",
              name: "Does Murmur save audio or transcript history?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Murmur does not save captured audio or transcript history by default. Audio is processed only while a live translation session is active.",
              },
            },
          ],
        },
      ]
    : [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          description: page.description,
          name: page.title,
          url: canonicalUrl,
        },
      ];

  const payload = page.isMarketing
    ? {
        "@context": "https://schema.org",
        "@graph": graph,
      }
    : graph[0];

  return `<script type="application/ld+json">${JSON.stringify(payload).replaceAll("<", "\\u003c")}</script>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
