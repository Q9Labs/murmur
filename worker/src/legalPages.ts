type Page = {
  description: string;
  html: string;
  keywords?: string;
  path: string;
  title: string;
  isMarketing?: boolean;
};

const lastUpdated = "2026-05-22";
const marketingUpdated = "2026-05-20";
const siteUrl = "https://murmur.q9labs.ai";
const siteName = "Murmur Translate";
const supportEmail = "q9labs.ai@gmail.com";
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

export const legalPages: Record<string, Page> = {
  "/": {
    isMarketing: true,
    path: "/",
    title: "Murmur Translate | Accountless Live Speech Translation App",
    description:
      "Murmur is an accountless live speech translation app with real-time translated captions, optional translated speech, and no cloud transcript history by default.",
    keywords: defaultKeywords,
    html: `
      <section class="hero-section">
        <div class="hero-card">
          <div class="hero-wave hero-wave-coral"></div>
          <div class="hero-wave hero-wave-mint"></div>
          <div class="hero-inner">
            <div class="preview-header">
              <span>English</span>
              <span class="preview-arrow">→</span>
              <span>Arabic</span>
            </div>
            <h2 class="preview-translation">أين محطة القطار؟</h2>
            <p class="preview-source">Where is the train station?</p>
            <div class="preview-meter">
              <div class="meter-bar" style="height: 14px; opacity: 0.75;"></div>
              <div class="meter-bar" style="height: 28px; opacity: 0.9;"></div>
              <div class="meter-bar" style="height: 42px;"></div>
              <div class="meter-bar" style="height: 28px; opacity: 0.9;"></div>
              <div class="meter-bar" style="height: 14px; opacity: 0.75;"></div>
            </div>
          </div>
        </div>
        <div class="hero-copy">
          <h1>Murmur Translate: accountless live speech translation</h1>
          <p>Speak once and see translated captions appear in real time. Murmur is built for simple one-way moments: choose a language direction, tap Listen, and follow the translation as speech is recognized.</p>
          <div class="hero-actions">
            <span class="button-pill-coral" aria-disabled="true">Listen</span>
            <p class="hero-hint">Store links will appear after review.</p>
          </div>
        </div>
      </section>

      <section class="privacy-panel">
        <div class="privacy-mic-shell">
          <div class="privacy-mic">
            <div class="mic-capsule"></div>
            <div class="mic-stem"></div>
          </div>
          <div class="pulse-outer"></div>
          <div class="pulse-inner"></div>
        </div>
        <h3>Only while listening</h3>
        <p>Microphone access is used during live sessions. Murmur processes stable captions only to translate them, and does not save audio or transcript history by default.</p>
      </section>

      <section class="feature-grid">
        <div class="feature-card">
          <h4>One-way live translation</h4>
          <p>Pick a source and target language, then translate speech into clear captions as stable phrases are recognized.</p>
        </div>
        <div class="feature-card">
          <h4>No account required</h4>
          <p>No login, profile, subscription account, or synced transcript library in V1.</p>
        </div>
        <div class="feature-card">
          <h4>Captions first</h4>
          <p>Translated captions stay useful even when generated speech is unavailable or delayed.</p>
        </div>
        <div class="feature-card">
          <h4>Privacy-conscious defaults</h4>
          <p>Murmur does not save audio or transcript history by default. Microphone audio is used only during live sessions.</p>
        </div>
      </section>

      <section class="positioning-panel">
        <h2>Built for simple one-way live translation</h2>
        <p>Many translation apps focus on text, cameras, phrasebooks, or two-person conversation modes. Murmur focuses on one thing: turning live speech into translated captions you can read as the session happens.</p>
      </section>
    `,
  },
  "/privacy": {
    description: "Murmur privacy policy for accountless live translation.",
    path: "/privacy",
    title: "Murmur Privacy Policy",
    html: `
      <h1>Murmur Privacy Policy</h1>
      <p><strong>Last updated:</strong> ${lastUpdated}</p>
      <p>Murmur is an accountless one-way live translator. You choose a source language and a target language, tap Listen, speak, and Murmur shows translated captions. Speech output may play translated phrases when available.</p>
      <p>Before a live translation session starts, Murmur asks for permission to share the data needed for live AI translation with the third-party processors named below. The app does not create a provider session or request microphone audio until this permission is granted.</p>
      <h2>Data Murmur Processes</h2>
      <p><strong>Microphone audio.</strong> Murmur collects microphone audio from the device microphone only while a live translation session is active. Audio is transmitted to Deepgram for speech-to-text. Murmur does not save microphone audio by default.</p>
      <p><strong>Source captions.</strong> Deepgram returns source-language captions from your speech. Stable caption spans are sent through Murmur's Cloudflare Worker to OpenRouter and its routed model provider for translation. Murmur does not save transcript history by default.</p>
      <p><strong>Translated captions and speech.</strong> OpenRouter returns translated text for local display. If speech output is enabled, stable translated phrases are sent to Cartesia to generate speech audio.</p>
      <p><strong>Anonymous install and session metadata.</strong> Murmur has no accounts, login, profile, or cloud transcript history in V1. The app creates an anonymous install identifier stored in platform secure storage. The Worker hashes this identifier and uses it for rate limits, abuse prevention, diagnostics, and provider-token minting.</p>
      <p><strong>Translation reports.</strong> You can report inaccurate, wrong-language, harmful, speech-related, or other translation issues. Reports include session/span metadata and may include text snapshots only when explicitly submitted by the app.</p>
      <p><strong>Diagnostics and latency telemetry.</strong> Murmur may process timing, provider metadata, error codes, language pair, network type, and request/session identifiers to debug reliability and measure latency. Logs should not include raw microphone audio, source captions, translated captions, provider tokens, or generated speech audio by default.</p>
      <h2>Third-Party Processors</h2>
      <p>Murmur's V1 architecture uses Cloudflare for the Worker gateway, Deepgram for streaming speech-to-text, OpenRouter and routed model providers for translation, and Cartesia for optional translated speech generation. Murmur requires third-party processors that handle user data for Murmur to provide the same or equal protection for that data as described in this policy and required by applicable App Store privacy rules.</p>
      <h2>Retention</h2>
      <p>Murmur does not retain audio, transcript history, or translated caption history by default. Anonymous session/rate-limit metadata is retained only as needed for abuse prevention, diagnostics, and service operation. Translation reports may be retained for support, safety, and quality review.</p>
      <h2>Your Choices</h2>
      <ul>
        <li>Stop or cancel a live session at any time.</li>
        <li>Use translated captions even when speech output is unavailable.</li>
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
      <p>Murmur uses speech recognition, machine translation, and speech generation providers. AI output can be delayed, incomplete, inaccurate, offensive, or inappropriate. Murmur may show captions when speech output is unavailable.</p>
      <p>You can report translation issues in the app. Reports help support and quality review, but they do not guarantee that a specific translation will be corrected.</p>
      <h2>Accounts and Local Data</h2>
      <p>Murmur V1 has no accounts, login, profile, or cloud transcript history. The app stores an anonymous install identifier locally for rate limits, abuse prevention, diagnostics, and provider-token minting. You can reset this identity or delete local Murmur data in the app.</p>
      <h2>Acceptable Use</h2>
      <ul>
        <li>Do not break the law or violate someone else's rights.</li>
        <li>Do not harass, threaten, abuse, impersonate, or exploit others.</li>
        <li>Do not generate or distribute hateful, sexual, violent, deceptive, or harmful content.</li>
        <li>Do not attempt to bypass rate limits, device integrity checks, provider restrictions, or security controls.</li>
        <li>Do not reverse engineer, scrape, overload, or disrupt Murmur or its providers.</li>
        <li>Do not attempt to access administrative endpoints or private diagnostics data.</li>
      </ul>
      <h2>Privacy and Third-Party Services</h2>
      <p>Murmur's privacy practices are described in the Murmur Privacy Policy. Murmur relies on third-party processors for speech recognition, translation, speech generation, infrastructure, diagnostics, and support workflows. Their services may be unavailable or may change independently from Murmur.</p>
      <h2>Availability</h2>
      <p>Murmur may change, suspend, or discontinue features. Provider failures, network conditions, microphone permissions, unsupported languages, quotas, or device limitations may prevent live translation or speech output.</p>
      <h2>No Warranty</h2>
      <p>Murmur is provided as-is and as-available. To the maximum extent allowed by law, Murmur disclaims warranties of accuracy, availability, fitness for a particular purpose, and non-infringement.</p>
      <h2>Limitation of Liability</h2>
      <p>To the maximum extent allowed by law, Murmur is not liable for losses caused by translation errors, delays, service interruptions, provider failures, misuse, or reliance on AI output.</p>
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
      <p>The app stores an anonymous install identifier on the device. Use <strong>Reset Murmur Identity</strong> to replace it, or <strong>Delete Local Data</strong> to clear the anonymous install id and local privacy acknowledgement.</p>
      <h2>Server-Side Deletion Requests</h2>
      <p>Murmur may process rate-limit metadata, diagnostic records, and translation report receipts. Support can review deletion requests for records that can reasonably be tied to a user-supplied receipt or anonymous install/session metadata.</p>
      <p>Support will not ask users to send microphone recordings, full transcripts, government IDs, passwords, private keys, or app store credentials.</p>
      <h2>Report Translation Triage</h2>
      <p>Murmur's in-app report categories are inaccurate, wrong language, harmful or offensive, speech issue, and other.</p>
      <h2>Store Submission Notes</h2>
      <p>Store reviewers can use the app without creating an account. Tap Listen, speak a phrase, review translated captions, and use the report buttons on a committed translation span.</p>
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
  const socialTitle = page.isMarketing
    ? "Murmur Translate | Accountless Live Speech Translation"
    : page.title;
  const socialDescription = page.isMarketing
    ? "Translate live speech into readable captions in another language. No account, no login, and no cloud transcript history by default."
    : page.description;
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
        max-width: 900px;
        margin: 0 auto;
        padding: 0 24px;
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
      .hero-section {
        display: flex;
        flex-direction: column;
        gap: 48px;
        padding-top: 40px;
      }

      @media (min-width: 768px) {
        .hero-section {
          flex-direction: row-reverse;
          align-items: center;
          justify-content: space-between;
          padding-top: 60px;
        }
        .hero-copy { flex: 1; }
        .hero-card { flex: 1; max-width: 420px; }
      }

      .hero-card {
        background: var(--deep-teal);
        border-radius: 32px;
        padding: 32px 24px;
        position: relative;
        overflow: hidden;
        min-height: 320px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-shadow: 0 18px 28px rgba(13, 124, 102, 0.24);
      }

      .hero-wave {
        position: absolute;
        width: 260px;
        height: 58px;
        border-radius: 999px;
        opacity: 0.64;
        transform: rotate(-18deg);
      }

      .hero-wave-coral {
        background: #FF8A65;
        right: -74px;
        top: 20px;
      }

      .hero-wave-mint {
        background: #35D0BA;
        bottom: 24px;
        left: -86px;
      }

      .hero-inner { position: relative; z-index: 2; text-align: center; }

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #F8FFFC;
        font-size: 0.85rem;
        font-weight: 800;
        margin-bottom: 24px;
      }

      .preview-arrow { color: #B9F5E5; font-weight: 900; }

      .preview-translation {
        color: #FFFFFF;
        font-size: 2rem;
        font-weight: 800;
        margin: 0 0 12px;
        line-height: 1.2;
        direction: rtl;
      }

      .preview-source {
        color: #D8FFF4;
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }

      .preview-meter {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: 32px;
      }

      .meter-bar {
        width: 6px;
        background: var(--yellow);
        border-radius: 999px;
      }

      .hero-copy h1 {
        font-size: clamp(2.25rem, 8vw, 3.25rem);
        font-weight: 800;
        line-height: 1.1;
        margin: 0 0 20px;
        letter-spacing: 0;
      }

      .hero-copy p {
        font-size: 1.15rem;
        color: var(--text-secondary);
        margin: 0 0 32px;
        max-width: 400px;
        font-weight: 500;
      }

      .hero-actions { display: flex; flex-direction: column; gap: 12px; }

      .button-pill-coral {
        background: var(--coral);
        color: #FFFFFF;
        font-weight: 800;
        font-size: 1.125rem;
        padding: 16px 40px;
        border-radius: 999px;
        display: inline-block;
        text-align: center;
        width: fit-content;
        box-shadow: 0 10px 20px rgba(255, 107, 74, 0.24);
      }

      .hero-hint {
        font-size: 0.85rem;
        color: var(--text-secondary);
        font-weight: 700;
        margin: 0 !important;
      }

      .privacy-panel {
        background: #FFFFFF;
        border: 1px solid var(--mint-border);
        border-radius: 32px;
        padding: 48px 32px;
        text-align: center;
        margin-top: 80px;
        box-shadow: 0 16px 28px rgba(24, 169, 153, 0.14);
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .privacy-mic-shell {
        width: 210px;
        height: 210px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        margin-bottom: 24px;
      }

      .privacy-mic {
        background: var(--deep-teal);
        width: 76px;
        height: 76px;
        border-radius: 38px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 3;
      }

      .mic-capsule {
        width: 18px;
        height: 34px;
        background: #FFFFFF;
        border-radius: 999px;
      }

      .mic-stem {
        width: 5px;
        height: 18px;
        background: #FFFFFF;
        border-radius: 999px;
        margin-top: -2px;
      }

      .pulse-outer {
        position: absolute;
        width: 210px;
        height: 210px;
        background: #FF8A65;
        border-radius: 999px;
        opacity: 0.16;
      }

      .pulse-inner {
        position: absolute;
        width: 138px;
        height: 138px;
        background: var(--yellow);
        border-radius: 999px;
        opacity: 0.24;
      }

      .privacy-panel h3 {
        font-size: 2rem;
        font-weight: 800;
        color: var(--deep-teal-text);
        margin: 0 0 12px;
      }

      .privacy-panel p {
        font-size: 1.1rem;
        color: var(--text-secondary);
        max-width: 480px;
        margin: 0;
        font-weight: 600;
      }

      .feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 24px;
        margin-top: 48px;
      }

      .feature-card {
        background: var(--mint);
        border: 1px solid var(--mint-border);
        border-radius: 24px;
        padding: 24px;
      }

      .feature-card h4 {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--deep-teal-text);
        margin: 0 0 8px;
      }

      .feature-card p {
        font-size: 0.95rem;
        color: var(--text-secondary);
        margin: 0;
        font-weight: 600;
      }

      .positioning-panel {
        background: var(--cream);
        border-radius: 32px;
        margin-top: 48px;
        padding: 36px 32px;
      }

      .positioning-panel h2 {
        color: var(--deep-teal-text);
        font-size: clamp(1.75rem, 5vw, 2.35rem);
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1.15;
        margin: 0 0 14px;
      }

      .positioning-panel p {
        color: var(--text-secondary);
        font-size: 1.05rem;
        font-weight: 600;
        margin: 0;
        max-width: 680px;
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
