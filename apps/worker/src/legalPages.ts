type Page = {
  description: string;
  html: string;
  keywords?: string;
  path: string;
  title: string;
  isMarketing?: boolean;
};

const lastUpdated = "2026-08-29";
const marketingUpdated = "2026-07-30";
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
  "accountless translator app",
  "one-way live translator",
  "AI speech translation",
  "voice translator with captions",
].join(", ");

type MarketingLandingPageOptions = {
  campaignToken: string;
  description: string;
  examples: string[];
  eyebrow: string;
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
      <section class="landing-hero">
        <p class="landing-eyebrow">${escapeHtml(options.eyebrow)}</p>
        <h1>${escapeHtml(options.heading)}</h1>
        <p class="lede">${escapeHtml(options.lede)}</p>
        <div class="hero-actions">
          <a class="store-button store-button-primary" href="${trackedAppStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
          <a class="store-button store-button-secondary" href="${trackedGooglePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
        </div>
        <p class="hero-points">Live translated captions · No account · No saved transcript history</p>
      </section>

      <section class="landing-grid">
        <div class="landing-copy">
          <p class="landing-eyebrow">How to use Murmur</p>
          <h2>${escapeHtml(options.useCaseTitle)}</h2>
          <p>${escapeHtml(options.useCaseBody)}</p>
          <ol class="landing-steps">
            <li>Choose the language being spoken.</li>
            <li>Choose the language you want to read.</li>
            <li>Tap Listen to start live translated captions.</li>
          </ol>
        </div>
        <div class="landing-caption-card">
          <span class="landing-live"><span class="dot-live"></span> Translating live</span>
          <p class="landing-translation">Where is the next stop?</p>
          <p class="landing-source" dir="rtl">أين المحطة التالية؟</p>
        </div>
      </section>

      <section class="landing-examples">
        <p class="landing-eyebrow">Good fits</p>
        <h2>Use live captions when you need to keep listening.</h2>
        <ul>${examples}</ul>
      </section>

      <section class="values landing-values">
        <div class="value">
          <h4>Captions first</h4>
          <p>Readable translated text remains useful when speech output is unavailable.</p>
        </div>
        <div class="value">
          <h4>No event setup</h4>
          <p>Start from your own phone without waiting for an organizer or host to configure a feed.</p>
        </div>
        <div class="value">
          <h4>Know the limits</h4>
          <p>AI output can be delayed, incomplete, or inaccurate. Use a qualified human interpreter for high-stakes decisions.</p>
        </div>
      </section>

      <section class="cta">
        <div class="cta-inner">
          <h2>Follow spoken language through live captions.</h2>
          <p>Download Murmur for iOS or Android. No account required.</p>
          <div class="hero-actions">
            <a class="store-button store-button-primary" href="${appStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
            <a class="store-button store-button-secondary" href="${googlePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
          </div>
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
      "Follow tours, talks, lectures, and conferences in another language with live translated captions. Murmur needs no account and saves no cloud transcript history by default.",
    keywords: defaultKeywords,
    html: `
      <section class="hero">
        <div class="hero-copy">
          <h1>Follow every word,<br><em>in your language.</em></h1>
          <p class="lede">Murmur turns a guide, speaker, or lecturer into live translated captions on your phone. Pick a language direction, tap Listen, and read along.</p>
          <div class="hero-actions">
            <a class="store-button store-button-primary" href="${appStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
            <a class="store-button store-button-secondary" href="${googlePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
          </div>
          <p class="hero-points">Real-time captions · No account · Nothing saved by default</p>
        </div>
        <div class="hero-card">
          <span class="hero-card-glow"></span>
          <div class="hero-inner">
            <div class="lang-row"><span class="dot-live"></span> Translating live</div>
            <div class="cap-stack">
              <div class="cap-slide cap-1"><p class="cap-translation" dir="rtl">أين محطة القطار؟</p><p class="cap-source">English &rarr; Arabic &middot; &ldquo;Where is the train station?&rdquo;</p></div>
              <div class="cap-slide cap-2"><p class="cap-translation">&iquest;D&oacute;nde est&aacute; la estaci&oacute;n?</p><p class="cap-source">English &rarr; Spanish &middot; &ldquo;Where is the station?&rdquo;</p></div>
              <div class="cap-slide cap-3"><p class="cap-translation">&#38651;&#36554;&#12398;&#39365;&#12399;&#12393;&#12371;&#12391;&#12377;&#12363;&#65311;</p><p class="cap-source">English &rarr; Japanese &middot; &ldquo;Where is the train station?&rdquo;</p></div>
            </div>
            <div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          </div>
        </div>
      </section>

      <div class="ticker" aria-hidden="true">
        <div class="ticker-row">
          <span>English</span><span>Espa&ntilde;ol</span><span>&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</span><span>&#26085;&#26412;&#35486;</span><span>Fran&ccedil;ais</span><span>&#2361;&#2367;&#2344;&#2381;&#2342;&#2368;</span><span>Deutsch</span><span>&#20013;&#25991;</span><span>Portugu&ecirc;s</span><span>&#54620;&#44397;&#50612;</span><span>Italiano</span><span>T&uuml;rk&ccedil;e</span><span>English</span><span>Espa&ntilde;ol</span><span>&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</span><span>&#26085;&#26412;&#35486;</span><span>Fran&ccedil;ais</span><span>&#2361;&#2367;&#2344;&#2381;&#2342;&#2368;</span><span>Deutsch</span><span>&#20013;&#25991;</span><span>Portugu&ecirc;s</span><span>&#54620;&#44397;&#50612;</span><span>Italiano</span><span>T&uuml;rk&ccedil;e</span>
        </div>
      </div>

      <section class="section">
        <div class="section-head">
          <h2>From spoken words to readable captions.</h2>
          <p>No phrasebook or organizer setup. Murmur listens to the person in front of you and writes what they say in your language.</p>
        </div>
        <div class="steps">
          <div class="step">
            <div class="stage stage-mint">
              <div class="pick"><span class="pill">English</span><span class="pick-arrow">→</span><span class="pill pill-alt">Arabic</span></div>
            </div>
            <h3>Pick a direction</h3>
            <p>Choose the language you&rsquo;ll hear and the one you want to read.</p>
          </div>
          <div class="step">
            <div class="stage stage-teal">
              <span class="mic-pulse"></span><span class="mic-pulse"></span>
              <div class="mic-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg></div>
            </div>
            <h3>Tap Listen</h3>
            <p>Murmur uses your microphone only while a session is live.</p>
          </div>
          <div class="step">
            <div class="stage stage-cream">
              <div class="caption-demo"><span class="cap-line">&iquest;D&oacute;nde est&aacute; la estaci&oacute;n?</span><span class="cap-line">Where is the station?</span></div>
            </div>
            <h3>Read along</h3>
            <p>Translated captions appear as each part of the speech is recognized.</p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>One app for quick moments and full talks.</h2>
          <p>Use Murmur for a short exchange or keep live translated captions moving while a guide, lecturer, or conference speaker continues.</p>
        </div>
        <div class="use-case-links">
          <a class="use-case-link use-case-link-travel" href="/live-translation-for-travel">
            <span class="use-case-kicker">Tours and travel</span>
            <strong>Read along with a guide.</strong>
            <span>Follow explanations, directions, and short conversations without passing the phone back and forth.</span>
          </a>
          <a class="use-case-link use-case-link-talks" href="/live-translation-for-talks">
            <span class="use-case-kicker">Talks and lectures</span>
            <strong>Keep up while the speaker continues.</strong>
            <span>Use a rolling translated-caption timeline for lectures, workshops, demonstrations, and conference talks.</span>
          </a>
        </div>
      </section>

      <section class="values">
        <div class="value">
          <div class="value-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h4M7 14h7M15 10h2"/></svg></div>
          <h4>Captions first</h4>
          <p>Clear, readable text &mdash; even when spoken output isn&rsquo;t available.</p>
        </div>
        <div class="value">
          <div class="value-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17 9l4 4M21 9l-4 4"/></svg></div>
          <h4>No account</h4>
          <p>No login, profile, or subscription to get in your way.</p>
        </div>
        <div class="value">
          <div class="value-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
          <h4>Yours alone</h4>
          <p>No audio or transcript history saved by default.</p>
        </div>
      </section>

      <section class="cta">
        <div class="cta-inner">
          <h2>Take Murmur to your next tour or talk.</h2>
          <p>Free to try, with nothing to sign up for. Download Murmur and follow spoken language through live captions.</p>
          <div class="hero-actions">
            <a class="store-button store-button-primary" href="${appStoreUrl}" rel="noopener">${appleLogoSvg}<span>App Store</span></a>
            <a class="store-button store-button-secondary" href="${googlePlayUrl}" rel="noopener">${playLogoSvg}<span>Google Play</span></a>
          </div>
        </div>
      </section>
    `,
  },
  "/live-translation-for-travel": buildMarketingLandingPage({
    campaignToken: "travel",
    path: "/live-translation-for-travel",
    title: "Live Translation for Travel and Tours | Murmur",
    description:
      "Follow guides and spoken explanations in another language with live translated captions on your phone. No account required.",
    keywords: "live translation for travel, tour guide translator, travel voice translator, live captions for tours",
    eyebrow: "Live translation for travel",
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
      "Read live translated captions while a lecturer, workshop host, or conference speaker continues talking. No event setup or account required.",
    keywords: "conference speech translator, live translation for lectures, translated captions for talks, event voice translator",
    eyebrow: "Live translation for talks",
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
    eyebrow: "English to Arabic",
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
    eyebrow: "Arabic to English",
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
    description: "Murmur privacy policy for accountless live translation.",
    path: "/privacy",
    title: "Murmur Privacy Policy",
    html: `
      <h1>Murmur Privacy Policy</h1>
      <p><strong>Last updated:</strong> ${lastUpdated}</p>
      <p>Murmur is an accountless one-way live translator. You choose a source language and a target language, tap Listen, speak, and Murmur shows translated captions. Speech output may play translated phrases when available.</p>
      <p>Before a live translation session starts, Murmur asks for permission to share the data needed for live AI translation with OpenAI Realtime through Murmur's Cloudflare Worker. The app does not open an OpenAI Realtime connection or request microphone audio until this permission is granted.</p>
      <h2>Data Murmur Processes</h2>
      <p><strong>Microphone audio.</strong> Murmur collects microphone audio from the device microphone only while a live translation session is active. Audio passes through Murmur's Cloudflare Worker to OpenAI Realtime for live transcription, translation, and translated speech. Murmur does not save microphone audio by default.</p>
      <p><strong>Source and translated captions.</strong> OpenAI Realtime returns source-language and translated captions through Murmur's Cloudflare Worker for local display. Murmur does not save transcript history by default.</p>

      <p><strong>Anonymous install and session metadata.</strong> Murmur has no accounts, login, profile, or cloud transcript history in V1. The app creates an anonymous install identifier stored in platform secure storage. The Worker hashes this identifier and uses it for rate limits, abuse prevention, diagnostics, and pseudonymous session measurement. The app includes controls to reset the anonymous identity and delete local Murmur data.</p>
      <p><strong>Campaign and referral tags.</strong> When Murmur is opened directly through a tagged app link, it may process a short allowlisted source, medium, campaign, content, partner, or landing-page label with the next successful live session. These labels are normalized, length-limited, and consumed after that session starts. Store-page links use Apple or Google campaign parameters measured by the respective store; Murmur does not currently copy iOS install attribution into an in-app session. Murmur does not put audio or caption text in campaign attribution.</p>
      <p><strong>Local engagement state.</strong> Murmur stores a qualified-session count and the version and time of its last native rating request on the device. This state is used only to avoid interrupting a live or unsuccessful session and to avoid repeatedly asking for a rating. It contains no audio or caption text.</p>
      <p><strong>Translation reports.</strong> You can report inaccurate, wrong-language, harmful, speech-related, or other translation issues. Reports include session/span metadata and may include text snapshots only when explicitly submitted by the app.</p>
      <p><strong>Product analytics, diagnostics, and latency telemetry.</strong> Murmur uses anonymous product analytics to measure activation, translation completion and issue-report categories, latency, return use, and failures. Events can include app and build version, platform, language pair, broad network type, feature settings, timing, duration, error category, audio byte or frame counts, caption character counts, and whether a committed translation occurred. They never include microphone audio, source captions, translated captions, generated speech audio, advertising identifiers, precise location, contacts, or account data.</p>
      <p>The app sends analytics events to Murmur's Cloudflare Worker. The Worker validates a fixed event schema, hashes the anonymous install identifier, and forwards the allowed event properties to PostHog US. PostHog does not receive the raw install identifier or the device's IP address from Murmur. Murmur disables PostHog person profiles, geolocation, autocapture, and session replay.</p>
      <p>Murmur uses Sentry for crash, error, and sampled performance monitoring. Murmur disables screenshots, view hierarchy capture, session replay, request bodies, cookies, query strings, user fields, and default personally identifiable information. Sentry may receive a sanitized stack trace, operation and error categories, release, environment, app session identifier, and limited performance timing. Sentry does not receive conversation content from Murmur.</p>
      <h2>Third-Party Processors</h2>
      <p>Murmur uses Cloudflare for the Worker gateway, OpenAI Realtime for live transcription and translation, PostHog US for anonymous product analytics, and Sentry for sanitized error and performance monitoring. Murmur requires third-party processors that handle user data for Murmur to provide the same or equal protection for that data as described in this policy and required by applicable App Store privacy rules.</p>
      <h2>Retention</h2>
      <p>Murmur does not retain audio, transcript history, or translated caption history by default. Anonymous analytics, diagnostics, session, campaign, and rate-limit metadata is retained only as needed for product measurement, abuse prevention, debugging, and service operation, then deleted or anonymized under Murmur's provider retention settings. Local engagement state remains on the device until it is replaced or the user selects Delete Local Data. Translation reports may be retained for support, safety, and quality review.</p>
      <h2>Your Choices</h2>
      <ul>
        <li>Stop or cancel a live session at any time.</li>
        <li>Use translated captions even when speech output is unavailable.</li>
        <li>Turn Anonymous Analytics off or on in Settings. Analytics is on by default until you turn it off. Turning it off stops new PostHog product analytics events; essential sanitized crash and error monitoring can continue.</li>
        <li>Reset Murmur Identity in the app.</li>
        <li>Delete Local Data in the app.</li>
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
      <p>Murmur is an accountless one-way live translation app. You choose a source language and a target language, tap Listen, speak, and Murmur shows translated captions. Optional speech output may play translated phrases when available.</p>
      <h2>Using Murmur</h2>
      <p>Use Murmur only where live translation is appropriate and lawful. You are responsible for the speech you provide to the app and for deciding whether translated output is accurate enough for your situation.</p>
      <p>Murmur is not intended for emergencies, medical diagnosis, legal advice, immigration advice, financial decisions, or other high-stakes situations where an incorrect translation could cause harm. Always verify important translations with a qualified human interpreter.</p>
      <h2>AI Translation Limits</h2>
      <p>OpenAI Realtime handles speech recognition, translation, and translated speech. Its output can be delayed, incomplete, inaccurate, offensive, or inappropriate. Murmur may show captions when speech output is unavailable.</p>
      <p>You can report translation issues in the app. Reports help support and quality review, but they do not guarantee that a specific translation will be corrected.</p>
      <h2>Accounts and Local Data</h2>
      <p>Murmur V1 has no accounts, login, profile, or cloud transcript history. The app stores an anonymous install identifier locally for rate limits, abuse prevention, diagnostics, and pseudonymous session measurement. You can reset this identity or delete local Murmur data in the app.</p>
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
      <p>Murmur may change, suspend, or discontinue features. OpenAI Realtime or Cloudflare failures, network conditions, microphone permissions, unsupported languages, quotas, or device limitations may prevent live translation or speech output.</p>
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
      <h2>Accountless App Explanation</h2>
      <p>Murmur V1 does not create accounts. There is no login, profile, password, subscription account, cloud transcript history, or account deletion flow.</p>
      <p>The app stores an anonymous install identifier, interface preference, and rating-prompt eligibility state on the device. Use <strong>Reset Murmur Identity</strong> to replace the identifier, or <strong>Delete Local Data</strong> to clear all of this local Murmur data and the privacy acknowledgement.</p>
      <h2>Server-Side Deletion Requests</h2>
      <p>Murmur may process rate-limit metadata, diagnostic records, and translation report receipts. Support can review deletion requests for records that can reasonably be tied to a user-supplied receipt or anonymous install/session metadata.</p>
      <p>Support will not ask users to send microphone recordings, full transcripts, government IDs, passwords, private keys, or app store credentials.</p>
      <h2>Report Translation Triage</h2>
      <p>Murmur's in-app report categories are inaccurate, wrong language, harmful or offensive, speech issue, and other.</p>
      <h2>Store Submission Notes</h2>
      <p>Store reviewers can use the app without creating an account. Tap Listen, speak naturally, review translated captions, and use the report buttons on a committed translation span.</p>
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
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
    <style>
      :root {
        --canvas: #F4FFF9;
        --mint: #EFFAF6;
        --mint-border: #D8F3E8;
        --cream: #F8F4ED;
        --deep-teal: #0D7C66;
        --deep-teal-text: #123D35;
        --coral: #FF6B4A;
        --yellow: #FFD166;
        --text-primary: #151513;
        --text-secondary: #6B7B72;
        --font-main: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --font-display: "Bricolage Grotesque", ui-rounded, "Segoe UI", system-ui, sans-serif;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--canvas);
        color: var(--text-primary);
        font-family: var(--font-main);
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }

      .container {
        max-width: 1180px;
        margin: 0 auto;
        padding: 0 28px;
      }

      header {
        padding: 24px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .logo-link {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        color: var(--deep-teal-text);
        font-weight: 900;
        font-size: 1.25rem;
      }

      nav {
        display: flex;
        gap: 20px;
      }

      nav a {
        text-decoration: none;
        color: var(--text-secondary);
        font-weight: 700;
        font-size: 0.9rem;
        transition: color 0.2s;
      }

      nav a:hover { color: var(--deep-teal); }

      main { padding-bottom: 80px; }

      /* Marketing Styles */
      .hero {
        display: flex;
        flex-direction: column;
        gap: 44px;
        padding-top: 40px;
      }

      @media (min-width: 880px) {
        .hero {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 72px;
          padding-top: 72px;
        }
        .hero-copy { flex: 1.05; }
        .hero-card { flex: 1; max-width: 480px; }
      }

      .hero-copy h1 {
        font-family: var(--font-display);
        font-size: clamp(2.8rem, 7.5vw, 5.2rem);
        font-weight: 800;
        line-height: 0.98;
        letter-spacing: -0.035em;
        margin: 0 0 24px;
      }
      .hero-copy h1 em { font-style: normal; color: var(--coral); }

      .lede {
        font-size: clamp(1.1rem, 2.2vw, 1.3rem);
        color: var(--text-secondary);
        line-height: 1.55;
        max-width: 480px;
        margin: 0 0 30px;
        font-weight: 500;
      }

      .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }

      .hero-points {
        margin: 26px 0 0;
        color: var(--text-secondary);
        font-weight: 700;
        font-size: 0.95rem;
      }

      .store-button {
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 54px;
        padding: 14px 26px;
        text-decoration: none;
        font-size: 1rem;
        font-weight: 800;
        line-height: 1.2;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .store-button:hover { transform: translateY(-2px); }
      .store-logo { width: 22px; height: 22px; flex: 0 0 auto; }
      .store-button-primary {
        background: var(--coral);
        color: #FFFFFF;
        box-shadow: 0 12px 24px rgba(255, 107, 74, 0.28);
      }
      .store-button-secondary {
        background: #FFFFFF;
        border: 1px solid var(--mint-border);
        color: var(--deep-teal-text);
        box-shadow: 0 10px 18px rgba(13, 124, 102, 0.12);
      }

      /* Hero live preview */
      .hero-card {
        position: relative;
        overflow: hidden;
        background: var(--deep-teal);
        border-radius: 32px;
        padding: 30px 26px;
        min-height: 340px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-shadow: 0 24px 48px rgba(13, 124, 102, 0.28);
      }
      .hero-card-glow {
        position: absolute;
        width: 280px;
        height: 280px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(127, 231, 212, 0.42), transparent 68%);
        top: -100px;
        right: -80px;
        pointer-events: none;
      }

      .hero-inner { position: relative; z-index: 2; }
      .dot-live {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--coral);
        box-shadow: 0 0 0 4px rgba(255, 107, 74, 0.22);
        animation: blink 1.4s ease-in-out infinite;
      }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

      .lang-row {
        display: flex;
        align-items: center;
        gap: 9px;
        margin: 0 0 16px;
        color: #BFEFE2;
        font-weight: 800;
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .cap-stack { position: relative; min-height: 132px; }
      .cap-slide {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 18px;
        padding: 18px 20px;
        opacity: 0;
        animation: capcycle 9s ease-in-out infinite;
      }
      .cap-2 { animation-delay: 3s; }
      .cap-3 { animation-delay: 6s; }
      @keyframes capcycle {
        0% { opacity: 0; transform: translateY(12px); }
        4% { opacity: 1; transform: translateY(0); }
        28% { opacity: 1; transform: translateY(0); }
        33% { opacity: 0; transform: translateY(-12px); }
        100% { opacity: 0; transform: translateY(-12px); }
      }
      .cap-translation {
        color: #FFFFFF;
        font-size: clamp(1.6rem, 4.6vw, 2rem);
        font-weight: 800;
        line-height: 1.2;
        margin: 0 0 10px;
      }
      .cap-source { color: #BFEFE2; font-size: 0.92rem; font-weight: 600; margin: 0; line-height: 1.45; }

      .eq { display: flex; align-items: flex-end; justify-content: center; gap: 5px; height: 40px; margin-top: 22px; }
      .eq i {
        width: 6px;
        height: 100%;
        background: var(--yellow);
        border-radius: 999px;
        transform-origin: bottom;
        animation: eq 1.1s ease-in-out infinite;
      }
      .eq i:nth-child(odd) { background: #7FE7D4; }
      .eq i:nth-child(2) { animation-delay: -0.9s; }
      .eq i:nth-child(3) { animation-delay: -0.6s; }
      .eq i:nth-child(4) { animation-delay: -0.3s; }
      .eq i:nth-child(5) { animation-delay: -0.75s; }
      .eq i:nth-child(6) { animation-delay: -0.15s; }
      .eq i:nth-child(7) { animation-delay: -0.5s; }
      .eq i:nth-child(8) { animation-delay: -0.85s; }
      .eq i:nth-child(9) { animation-delay: -0.35s; }
      @keyframes eq { 0%, 100% { transform: scaleY(0.28); } 50% { transform: scaleY(1); } }

      /* Languages ticker */
      .ticker {
        margin-top: 64px;
        overflow: hidden;
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
        mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
      }
      .ticker-row {
        display: inline-flex;
        gap: 44px;
        white-space: nowrap;
        will-change: transform;
        animation: ticker 34s linear infinite;
      }
      .ticker-row span {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: clamp(1.3rem, 3vw, 1.9rem);
        color: var(--deep-teal-text);
        opacity: 0.4;
      }
      .ticker-row span:nth-child(3n) { color: var(--coral); opacity: 0.75; }
      .ticker-row span:nth-child(5n) { color: var(--deep-teal); opacity: 0.7; }
      @keyframes ticker { to { transform: translateX(-50%); } }

      /* How it works */
      .section { padding-top: 84px; }
      .section-head { max-width: 620px; margin: 0 0 44px; }
      .section-head h2 {
        font-family: var(--font-display);
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1.05;
        color: var(--text-primary);
        margin: 0 0 14px;
      }
      .section-head p { font-size: 1.1rem; color: var(--text-secondary); font-weight: 500; margin: 0; line-height: 1.55; }

      .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
      @media (max-width: 760px) { .steps { grid-template-columns: 1fr; max-width: 420px; } }
      .stage {
        aspect-ratio: 5 / 4;
        border-radius: 26px;
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .stage > * { grid-area: 1 / 1; }
      .stage-mint { background: var(--mint); border: 1px solid var(--mint-border); }
      .stage-teal { background: var(--deep-teal); }
      .stage-cream { background: var(--cream); }
      .step h3 { font-family: var(--font-display); font-size: 1.35rem; font-weight: 700; margin: 22px 0 6px; color: var(--deep-teal-text); }
      .step p { color: var(--text-secondary); font-weight: 500; margin: 0; font-size: 0.98rem; line-height: 1.5; }

      .pick { display: flex; align-items: center; gap: 12px; }
      .pill { background: #FFFFFF; border: 1px solid var(--mint-border); color: var(--deep-teal-text); font-weight: 800; font-size: 0.95rem; padding: 12px 18px; border-radius: 999px; box-shadow: 0 8px 16px rgba(13, 124, 102, 0.08); }
      .pill-alt { background: var(--deep-teal); color: #FFFFFF; border-color: var(--deep-teal); }
      .pick-arrow { color: var(--coral); font-weight: 900; font-size: 1.3rem; animation: nudge 1.4s ease-in-out infinite; }
      @keyframes nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }

      .mic-btn { width: 84px; height: 84px; border-radius: 50%; background: #FFFFFF; display: grid; place-items: center; color: var(--deep-teal); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18); z-index: 2; }
      .mic-btn svg { width: 34px; height: 34px; }
      .mic-pulse { width: 84px; height: 84px; border-radius: 50%; background: var(--yellow); opacity: 0; animation: pulse-ring 2s ease-out infinite; }
      .mic-pulse:nth-child(2) { animation-delay: 1s; }
      @keyframes pulse-ring { 0% { transform: scale(0.7); opacity: 0.5; } 100% { transform: scale(1.9); opacity: 0; } }

      .caption-demo { width: 78%; display: grid; gap: 10px; }
      .cap-line {
        background: #FFFFFF;
        border: 1px solid var(--mint-border);
        border-radius: 14px 14px 14px 4px;
        padding: 10px 14px;
        font-weight: 700;
        font-size: 0.9rem;
        color: var(--deep-teal-text);
        box-shadow: 0 6px 14px rgba(13, 124, 102, 0.08);
        opacity: 0;
        animation: rise 3.6s ease-in-out infinite;
      }
      .cap-line:nth-child(2) { animation-delay: 1.8s; }
      @keyframes rise {
        0% { opacity: 0; transform: translateY(10px); }
        14%, 72% { opacity: 1; transform: translateY(0); }
        92%, 100% { opacity: 0; transform: translateY(-6px); }
      }

      .use-case-links {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
      }
      @media (max-width: 760px) { .use-case-links { grid-template-columns: 1fr; } }
      .use-case-link {
        min-height: 240px;
        border-radius: 28px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 10px;
        padding: 30px;
        text-decoration: none;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .use-case-link:hover { transform: translateY(-3px); box-shadow: 0 18px 32px rgba(13, 124, 102, 0.14); }
      .use-case-link-travel { background: var(--cream); color: var(--deep-teal-text); }
      .use-case-link-talks { background: var(--deep-teal); color: #FFFFFF; }
      .use-case-kicker { font-size: 0.82rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.72; }
      .use-case-link strong { font-family: var(--font-display); font-size: 1.7rem; line-height: 1.1; }
      .use-case-link > span:last-child { max-width: 480px; font-weight: 600; line-height: 1.55; opacity: 0.78; }

      .landing-hero {
        max-width: 830px;
        padding: 80px 0 48px;
      }
      .landing-hero h1 {
        font-family: var(--font-display);
        font-size: clamp(2.8rem, 7vw, 5rem);
        font-weight: 800;
        line-height: 0.98;
        letter-spacing: -0.035em;
        margin: 0 0 24px;
      }
      .landing-eyebrow {
        color: var(--coral);
        font-size: 0.84rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        margin: 0 0 14px;
        text-transform: uppercase;
      }
      .landing-grid {
        align-items: stretch;
        display: grid;
        gap: 32px;
        grid-template-columns: 1.15fr 0.85fr;
        padding-top: 50px;
      }
      @media (max-width: 760px) { .landing-grid { grid-template-columns: 1fr; } }
      .landing-copy, .landing-caption-card, .landing-examples {
        border-radius: 28px;
        padding: clamp(28px, 5vw, 48px);
      }
      .landing-copy { background: var(--cream); }
      .landing-copy h2, .landing-examples h2 {
        font-family: var(--font-display);
        font-size: clamp(2rem, 4.5vw, 3rem);
        line-height: 1.05;
        margin: 0 0 18px;
      }
      .landing-copy > p:not(.landing-eyebrow), .landing-examples li {
        color: var(--text-secondary);
        font-size: 1.05rem;
        font-weight: 500;
      }
      .landing-steps { color: var(--deep-teal-text); font-weight: 700; line-height: 1.8; padding-left: 24px; }
      .landing-caption-card {
        background: var(--deep-teal);
        box-shadow: 0 24px 48px rgba(13, 124, 102, 0.22);
        color: #FFFFFF;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 340px;
      }
      .landing-live {
        align-items: center;
        color: #BFEFE2;
        display: flex;
        font-size: 0.78rem;
        font-weight: 800;
        gap: 9px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .landing-translation {
        font-family: var(--font-display);
        font-size: clamp(2rem, 5vw, 3.4rem);
        font-weight: 800;
        line-height: 1.05;
        margin: 44px 0 18px;
      }
      .landing-source { color: #BFEFE2; font-size: 1.3rem; font-weight: 700; margin: 0; }
      .landing-examples { background: var(--mint); margin-top: 32px; }
      .landing-examples ul {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(3, 1fr);
        list-style: none;
        margin: 28px 0 0;
        padding: 0;
      }
      @media (max-width: 760px) { .landing-examples ul { grid-template-columns: 1fr; } }
      .landing-examples li {
        background: #FFFFFF;
        border: 1px solid var(--mint-border);
        border-radius: 18px;
        color: var(--deep-teal-text);
        padding: 22px;
      }
      .landing-values { padding-top: 64px; }

      /* Value props */
      .values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; padding-top: 84px; }
      @media (max-width: 760px) { .values { grid-template-columns: 1fr; max-width: 420px; } }
      .value { display: flex; flex-direction: column; }
      .value-ico { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: var(--mint); color: var(--deep-teal); margin-bottom: 14px; }
      .value-ico svg { width: 22px; height: 22px; }
      .value h4 { font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; color: var(--deep-teal-text); margin: 0 0 6px; }
      .value p { color: var(--text-secondary); font-weight: 500; margin: 0; font-size: 0.98rem; line-height: 1.5; }

      /* Closing CTA */
      .cta { margin-top: 84px; }
      .cta-inner {
        position: relative;
        overflow: hidden;
        background: var(--deep-teal);
        border-radius: 32px;
        padding: clamp(40px, 6vw, 72px) 32px;
        text-align: center;
        box-shadow: 0 24px 48px rgba(13, 124, 102, 0.26);
      }
      .cta-inner h2 {
        position: relative;
        z-index: 2;
        font-family: var(--font-display);
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: 800;
        color: #FFFFFF;
        letter-spacing: -0.02em;
        line-height: 1.05;
        margin: 0 0 14px;
      }
      .cta-inner p { position: relative; z-index: 2; color: #CFF6EB; font-size: 1.1rem; font-weight: 500; max-width: 440px; margin: 0 auto 28px; }
      .cta-inner .hero-actions { position: relative; z-index: 2; justify-content: center; }
      .cta-inner .store-button-secondary { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.25); color: #FFFFFF; box-shadow: none; }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation: none !important; }
        .cap-line { opacity: 1; }
        .cap-slide { opacity: 0; }
        .cap-slide.cap-1 { opacity: 1; }
        .eq i { transform: scaleY(0.7); }
      }

      /* Legal Styles */
      .legal-content {
        max-width: 760px;
        margin: 40px auto 0;
        line-height: 1.6;
      }

      .legal-content h1 { font-size: 3rem; font-weight: 800; margin-bottom: 24px; line-height: 1.1; }
      .legal-content h2 { font-size: 1.5rem; font-weight: 800; margin-top: 48px; color: var(--deep-teal-text); }
      .legal-content p, .legal-content li { font-size: 1.05rem; color: #444; }
      .legal-content ul { padding-left: 20px; }
      .legal-content a { color: var(--deep-teal); font-weight: 700; }

      footer {
        padding: 48px 0;
        border-top: 1px solid var(--mint-border);
        text-align: center;
        font-size: 0.85rem;
        color: var(--text-secondary);
        font-weight: 600;
      }
      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 18px;
        justify-content: center;
        margin-bottom: 18px;
      }
      .footer-links a { color: var(--deep-teal); text-decoration: none; }
      .footer-links a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <a href="/" class="logo-link">
          ${renderHeaderLogoSvg()}
          <span>${siteName}</span>
        </a>
        <nav aria-label="Main navigation">
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
        &copy; 2026 Q9 Labs. Murmur is an accountless AI translation service.
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
            "Accountless one-way live speech translation with real-time translated captions, optional translated speech, and no cloud transcript history by default.",
          featureList: [
            "One-way live speech translation",
            "Real-time translated captions",
            "Optional translated speech",
            "No account required in V1",
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
                text: "No. Murmur V1 has no login, profile, subscription account, or cloud transcript library.",
              },
            },
            {
              "@type": "Question",
              name: "Does Murmur save audio or transcript history?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Murmur does not save microphone audio or transcript history by default. Audio is processed only while a live translation session is active.",
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
