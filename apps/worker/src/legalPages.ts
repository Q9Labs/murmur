type Page = {
  description: string;
  html: string;
  keywords?: string;
  path: string;
  title: string;
  isMarketing?: boolean;
};

const lastUpdated = "2026-09-14";
const marketingUpdated = "2026-09-21";
const siteUrl = "https://murmur.q9labs.ai";
const siteName = "Murmur Translate";
const supportEmail = "q9labs.ai@gmail.com";
const appStoreUrl = "https://apps.apple.com/app/id6756962206";
const googlePlayUrl = "https://play.google.com/store/apps/details?id=com.q9labsai.murmur";
const appleLogoSvg = `<svg class="store-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.564 13.02c-.012-2.17 1.77-3.21 1.85-3.26-1.01-1.48-2.58-1.68-3.14-1.7-1.34-.13-2.61.79-3.29.79-.68 0-1.72-.77-2.83-.75-1.46.02-2.8.85-3.55 2.16-1.51 2.62-.39 6.5 1.08 8.63.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.81-.7 1.31 0 1.68.7 2.83.68 1.17-.02 1.91-1.06 2.62-2.11.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.28-.88-2.3-3.48M15.37 6.65c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.22"/></svg>`;
const playLogoSvg = `<svg class="store-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#00D7FE" d="M3.27 2.6a1.2 1.2 0 0 0-.32.86v17.08c0 .35.12.65.33.86l.06.05 9.46-9.46v-.22L3.33 2.55z"/><path fill="#FFC107" d="m16.07 15.06-3.16-3.16v-.22l3.16-3.16.07.04 3.74 2.13c1.07.6 1.07 1.6 0 2.21l-3.81 2.16z"/><path fill="#FF3D49" d="m16.14 15.02-3.23-3.23-9.64 9.64c.35.37.93.42 1.59.05l11.28-6.46"/><path fill="#00F076" d="M16.14 8.56 4.86 2.11C4.2 1.73 3.62 1.78 3.27 2.16l9.64 9.63z"/></svg>`;

// cspell:ignore Hugeicons Benvenuti Colosseo costruito duemila anni Seguitemi
// Icon paths from Hugeicons (free set); stroke attributes live on the wrapping svg.
const icons = {
  mic: `<path d="M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z"/><path d="M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22"/>`,
  captions: `<path d="M2 12C2 8.02033 2 6.03049 3.0528 4.70201C3.22119 4.48953 3.40678 4.29302 3.60746 4.11473C4.86213 3 6.74142 3 10.5 3H13.5C17.2586 3 19.1379 3 20.3925 4.11473C20.5932 4.29302 20.7788 4.48953 20.9472 4.70201C22 6.03049 22 8.02033 22 12C22 15.9797 22 17.9695 20.9472 19.298C20.7788 19.5105 20.5932 19.707 20.3925 19.8853C19.1379 21 17.2586 21 13.5 21H10.5C6.74142 21 4.86213 21 3.60746 19.8853C3.40678 19.707 3.22119 19.5105 3.0528 19.298C2 17.9695 2 15.9797 2 12Z"/><path d="M10.5 9H10C9.06812 9 8.60218 9 8.23463 9.15224C7.74458 9.35523 7.35523 9.74458 7.15224 10.2346C7 10.6022 7 11.0681 7 12C7 12.9319 7 13.3978 7.15224 13.7654C7.35523 14.2554 7.74458 14.6448 8.23463 14.8478C8.60218 15 9.06812 15 10 15H10.5M17 9H16.5C15.5681 9 15.1022 9 14.7346 9.15224C14.2446 9.35523 13.8552 9.74458 13.6522 10.2346C13.5 10.6022 13.5 11.0681 13.5 12C13.5 12.9319 13.5 13.3978 13.6522 13.7654C13.8552 14.2554 14.2446 14.6448 14.7346 14.8478C15.1022 15 15.5681 15 16.5 15H17"/>`,
  user: `<path d="M20 21.0001C19.713 17.269 16.7289 14.3151 12.995 14.0662L12 13.9999C11.6446 14.0096 11.3134 14.0225 11.0008 14.0378C7.3 14.2192 4.28417 17.3057 4 21.0001"/><circle cx="12" cy="6.99988" r="4"/>`,
  lock: `<path d="M12 14.5V17.5M13 14.5C13 15.0523 12.5523 15.5 12 15.5C11.4477 15.5 11 15.0523 11 14.5C11 13.9477 11.4477 13.5 12 13.5C12.5523 13.5 13 13.9477 13 14.5Z"/><path d="M16.5 9V6.5C16.5 4.01472 14.4853 2 12 2C9.51471 2 7.49999 4.01472 7.49999 6.5V9"/><path d="M4.2678 18.8447C4.49268 20.515 5.87612 21.8235 7.55965 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.8789 17.7547 20 16.6376 20 15.5C20 14.3624 19.8789 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55965 9.09909C5.87612 9.17649 4.49268 10.485 4.2678 12.1553C4.12104 13.2453 3.99999 14.3624 3.99999 15.5C3.99999 16.6376 4.12104 17.7547 4.2678 18.8447Z"/>`,
  gift: `<path d="M4 11V15C4 18.2998 4 19.9497 5.02513 20.9749C6.05025 22 7.70017 22 11 22H13C16.2998 22 17.9497 22 18.9749 20.9749C20 19.9497 20 18.2998 20 15V11"/><path d="M3 9C3 8.25231 3 7.87846 3.20096 7.6C3.33261 7.41758 3.52197 7.26609 3.75 7.16077C4.09808 7 4.56538 7 5.5 7H18.5C19.4346 7 19.9019 7 20.25 7.16077C20.478 7.26609 20.6674 7.41758 20.799 7.6C21 7.87846 21 8.25231 21 9C21 9.74769 21 10.1215 20.799 10.4C20.6674 10.5824 20.478 10.7339 20.25 10.8392C19.9019 11 19.4346 11 18.5 11H5.5C4.56538 11 4.09808 11 3.75 10.8392C3.52197 10.7339 3.33261 10.5824 3.20096 10.4C3 10.1215 3 9.74769 3 9Z"/><path d="M6 3.78571C6 2.79949 6.79949 2 7.78571 2H8.14286C10.2731 2 12 3.7269 12 5.85714V7H9.21429C7.43908 7 6 5.56091 6 3.78571Z"/><path d="M18 3.78571C18 2.79949 17.2005 2 16.2143 2H15.8571C13.7269 2 12 3.7269 12 5.85714V7H14.7857C16.5609 7 18 5.56091 18 3.78571Z"/><path d="M12 11L12 22"/>`,
  sparkles: `<path d="M15 2L15.5387 4.39157C15.9957 6.42015 17.5798 8.00431 19.6084 8.46127L22 9L19.6084 9.53873C17.5798 9.99569 15.9957 11.5798 15.5387 13.6084L15 16L14.4613 13.6084C14.0043 11.5798 12.4202 9.99569 10.3916 9.53873L8 9L10.3916 8.46127C12.4201 8.00431 14.0043 6.42015 14.4613 4.39158L15 2Z"/><path d="M7 12L7.38481 13.7083C7.71121 15.1572 8.84275 16.2888 10.2917 16.6152L12 17L10.2917 17.3848C8.84275 17.7112 7.71121 18.8427 7.38481 20.2917L7 22L6.61519 20.2917C6.28879 18.8427 5.15725 17.7112 3.70827 17.3848L2 17L3.70827 16.6152C5.15725 16.2888 6.28879 15.1573 6.61519 13.7083L7 12Z"/>`,
  coins: `<ellipse cx="15.5" cy="11" rx="6.5" ry="2"/><path d="M22 15.5C22 16.6046 19.0899 17.5 15.5 17.5C11.9101 17.5 9 16.6046 9 15.5"/><path d="M22 11V19.8C22 21.015 19.0899 22 15.5 22C11.9101 22 9 21.015 9 19.8V11"/><ellipse cx="8.5" cy="4" rx="6.5" ry="2"/><path d="M6 11C4.10819 10.7698 2.36991 10.1745 2 9M6 16C4.10819 15.7698 2.36991 15.1745 2 14"/><path d="M6 21C4.10819 20.7698 2.36991 20.1745 2 19L2 4"/><path d="M15 6V4"/>`,
  alert: `<path d="M13.9248 21H10.0752C5.44476 21 3.12955 21 2.27636 19.4939C1.42317 17.9879 2.60736 15.9914 4.97574 11.9985L6.90057 8.75333C9.17559 4.91778 10.3131 3 12 3C13.6869 3 14.8244 4.91777 17.0994 8.75332L19.0243 11.9985C21.3926 15.9914 22.5768 17.9879 21.7236 19.4939C20.8704 21 18.5552 21 13.9248 21Z"/><path d="M12 9V13"/><path d="M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z"/>`,
  phone: `<path d="M13.5 2H10.5C8.14298 2 6.96447 2 6.23223 2.73223C5.5 3.46447 5.5 4.64298 5.5 7V17C5.5 19.357 5.5 20.5355 6.23223 21.2678C6.96447 22 8.14298 22 10.5 22H13.5C15.857 22 17.0355 22 17.7678 21.2678C18.5 20.5355 18.5 19.357 18.5 17V7C18.5 4.64298 18.5 3.46447 17.7678 2.73223C17.0355 2 15.857 2 13.5 2Z"/><path d="M12.125 19H12M12.25 19C12.25 19.1381 12.1381 19.25 12 19.25C11.8619 19.25 11.75 19.1381 11.75 19C11.75 18.8619 11.8619 18.75 12 18.75C12.1381 18.75 12.25 18.8619 12.25 19Z"/>`,
  arrow: `<path d="M18.5 12L4.99997 12"/><path d="M13 18C13 18 19 13.5811 19 12C19 10.4188 13 6 13 6"/>`,
  tick: `<path d="M5 14L8.5 17.5L19 6.5"/>`,
} as const;

function icon(name: keyof typeof icons): string {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

type HeroStageCaption = {
  source: string;
  sourceDirection?: "rtl";
  sourceLocale: string;
  target: string;
  targetDirection?: "rtl";
  targetLocale: string;
};

type HeroStage = {
  captions: HeroStageCaption[];
  sourceLanguage: string;
  targetLanguage: string;
};

function renderHeroStage(stage: HeroStage): string {
  const captions = stage.captions
    .map((caption, index) => {
      const sourceDirection = caption.sourceDirection ? ` dir="${caption.sourceDirection}"` : "";
      const targetDirection = caption.targetDirection ? ` dir="${caption.targetDirection}"` : "";

      return `<p class="feed-item feed-${index + 1}"><strong lang="${caption.sourceLocale}"${sourceDirection}>${escapeHtml(caption.source)}</strong><span lang="${caption.targetLocale}"${targetDirection}>${escapeHtml(caption.target)}</span></p>`;
    })
    .join("");

  return `
        <div class="bloom-stage">
          <span class="bloom" aria-hidden="true"></span>
          <img class="stage-art" src="/site/hero.webp" alt="" width="1200" height="800" decoding="async">
          <div class="chips" aria-hidden="true">
            <span class="chip chip-1">Hola</span>
            <span class="chip chip-2" dir="rtl">مرحبا</span>
            <span class="chip chip-3">&#12371;&#12435;&#12395;&#12385;&#12399;</span>
            <span class="chip chip-4">Bonjour</span>
            <span class="chip chip-5">&#20320;&#22909;</span>
            <span class="chip chip-6">Ciao</span>
          </div>
          <div class="phone">
            <div class="phone-screen">
              <div class="pick"><span class="pill">${escapeHtml(stage.sourceLanguage)}</span><span class="pick-arrow">${icon("arrow")}</span><span class="pill pill-alt">${escapeHtml(stage.targetLanguage)}</span></div>
              <div class="feed">${captions}</div>
              <div class="listen" aria-hidden="true">
                <div class="eq"><i></i><i></i><i></i><i></i></div>
                <div class="mic-wrap"><span class="mic-pulse"></span><span class="mic-pulse"></span><div class="mic-btn mic-btn-live">${icon("mic")}</div></div>
                <div class="eq"><i></i><i></i><i></i><i></i></div>
              </div>
            </div>
          </div>
        </div>`;
}

const heroStage = renderHeroStage({
  sourceLanguage: "Italian",
  targetLanguage: "English",
  captions: [
    {
      source: "Benvenuti al Colosseo.",
      sourceLocale: "it",
      target: "Welcome to the Colosseum.",
      targetLocale: "en",
    },
    {
      source: "Fu costruito quasi duemila anni fa.",
      sourceLocale: "it",
      target: "It was built almost two thousand years ago.",
      targetLocale: "en",
    },
    {
      source: "Seguitemi verso l'arena.",
      sourceLocale: "it",
      target: "Follow me toward the arena.",
      targetLocale: "en",
    },
  ],
});

const englishToArabicHeroStage = renderHeroStage({
  sourceLanguage: "English",
  targetLanguage: "Arabic",
  captions: [
    {
      source: "Welcome to the old city.",
      sourceLocale: "en",
      target: "مرحبًا بكم في المدينة القديمة.",
      targetDirection: "rtl",
      targetLocale: "ar",
    },
    {
      source: "The museum opens at ten.",
      sourceLocale: "en",
      target: "يفتح المتحف في الساعة العاشرة.",
      targetDirection: "rtl",
      targetLocale: "ar",
    },
    {
      source: "Please follow me this way.",
      sourceLocale: "en",
      target: "يرجى اتباعي من هذا الطريق.",
      targetDirection: "rtl",
      targetLocale: "ar",
    },
  ],
});

const arabicToEnglishHeroStage = renderHeroStage({
  sourceLanguage: "Arabic",
  targetLanguage: "English",
  captions: [
    {
      source: "مرحبًا بكم في المدينة القديمة.",
      sourceDirection: "rtl",
      sourceLocale: "ar",
      target: "Welcome to the old city.",
      targetLocale: "en",
    },
    {
      source: "يفتح المتحف في الساعة العاشرة.",
      sourceDirection: "rtl",
      sourceLocale: "ar",
      target: "The museum opens at ten.",
      targetLocale: "en",
    },
    {
      source: "يرجى اتباعي من هذا الطريق.",
      sourceDirection: "rtl",
      sourceLocale: "ar",
      target: "Please follow me this way.",
      targetLocale: "en",
    },
  ],
});

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
  art?: "talks" | "travel";
  campaignToken: string;
  description: string;
  examples: string[];
  heading: string;
  heroStage?: string;
  keywords: string;
  lede: string;
  useCaseBody: string;
  useCaseTitle: string;
  path: string;
  title: string;
};

function buildMarketingLandingPage(options: MarketingLandingPageOptions): Page {
  const examples = options.examples
    .map((example) => `<li><span class="icon-tile tone-teal">${icon("tick")}</span>${escapeHtml(example)}</li>`)
    .join("");
  const art = options.art
    ? `<img class="landing-art" src="/site/${options.art}.webp" alt="" width="1200" height="800" loading="lazy" decoding="async">`
    : "";
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
        </div>${options.heroStage ?? heroStage}
      </section>

      <section class="section landing-copy">${art}
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
          <span class="icon-tile tone-coral">${icon("captions")}</span>
          <h3>Captions first</h3>
          <p>Readable translated text remains useful when speech output is unavailable.</p>
        </div>
        <div class="value">
          <span class="icon-tile tone-teal">${icon("phone")}</span>
          <h3>No event setup</h3>
          <p>Start from your own phone without waiting for an organizer or host to configure a feed.</p>
        </div>
        <div class="value">
          <span class="icon-tile tone-yellow">${icon("alert")}</span>
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
        </div>${heroStage}
      </section>

      <section class="section">
        <h2>From spoken words to readable captions.</h2>
        <div class="steps">
          <div class="step">
            <div class="stage stage-coral">
              <div class="pick"><span class="pill">English</span><span class="pick-arrow">${icon("arrow")}</span><span class="pill pill-alt">Arabic</span></div>
            </div>
            <h3>Pick a direction</h3>
            <p>Choose the language you&rsquo;ll hear and the one you want to read.</p>
          </div>
          <div class="step">
            <div class="stage stage-teal">
              <span class="mic-pulse"></span><span class="mic-pulse"></span>
              <div class="mic-btn">${icon("mic")}</div>
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
            <div class="scene scene-travel" aria-hidden="true">
              <img src="/site/travel.webp" alt="" width="1200" height="800" loading="lazy" decoding="async">
              <span class="go">${icon("arrow")}</span>
            </div>
            <strong>Read along with a guide.</strong>
            <span>Follow explanations, directions, and short conversations without passing the phone back and forth.</span>
          </a>
          <a class="use-case-link" href="/live-translation-for-talks">
            <div class="scene scene-talks" aria-hidden="true">
              <img src="/site/talks.webp" alt="" width="1200" height="800" loading="lazy" decoding="async">
              <span class="go">${icon("arrow")}</span>
            </div>
            <strong>Keep up while the speaker continues.</strong>
            <span>A rolling caption timeline for lectures, workshops, demonstrations, and conference talks.</span>
          </a>
        </div>
      </section>

      <section class="section values">
        <div class="value">
          <span class="icon-tile tone-coral">${icon("captions")}</span>
          <h3>Captions first</h3>
          <p>Clear, readable text &mdash; even when spoken output isn&rsquo;t available.</p>
        </div>
        <div class="value">
          <span class="icon-tile tone-teal">${icon("user")}</span>
          <h3>Guest first</h3>
          <p>Start without sign-up. Verify an email before purchase so a plan or credit balance can be recovered across devices.</p>
        </div>
        <div class="value">
          <span class="icon-tile tone-violet">${icon("lock")}</span>
          <h3>Yours alone</h3>
          <p>No audio or transcript history saved by default.</p>
        </div>
      </section>

      <section class="section" id="pricing">
        <h2>Start free. Add time when you need it.</h2>
        <div class="price-grid">
          <article class="price-card">
            <span class="icon-tile tone-teal">${icon("gift")}</span>
            <h3>Free</h3>
            <p class="price">$0</p>
            <p>30 minutes every month.</p>
          </article>
          <article class="price-card price-card-featured">
            <span class="bloom" aria-hidden="true"></span>
            <span class="icon-tile tone-yellow">${icon("sparkles")}</span>
            <h3>Murmur Pro</h3>
            <p class="price">$12.99 <span>/ month</span></p>
            <p>3 hours every month, or $124.99 yearly.</p>
          </article>
          <article class="price-card">
            <span class="icon-tile tone-violet">${icon("coins")}</span>
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
    art: "travel",
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
    art: "talks",
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
    heroStage: englishToArabicHeroStage,
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
    heroStage: arabicToEnglishHeroStage,
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
      }
      h1, h2, h3, p { margin: 0; }
      a:focus-visible { outline: 3px solid var(--canvas); outline-offset: 2px; border-radius: 6px; box-shadow: 0 0 0 6px var(--ink); }

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
      @media (max-width: 520px) {
        header { align-items: flex-start; flex-direction: column; }
        nav { flex-wrap: wrap; gap: 16px; }
        nav a { font-size: 0.88rem; }
      }

      main { overflow-x: clip; padding-bottom: 96px; }

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

      .hero h1, .lede, .hero-actions, .bloom-stage { animation: enter 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
      .lede { animation-delay: 0.08s; }
      .hero-actions { animation-delay: 0.16s; }
      .bloom-stage { animation-delay: 0.28s; }
      @keyframes enter { from { opacity: 0; translate: 0 24px; } to { opacity: 1; translate: 0 0; } }

      .bloom-stage {
        position: relative;
        max-width: 780px;
        margin: clamp(48px, 7vw, 72px) auto 0;
        padding: clamp(24px, 5vw, 48px) 0;
      }
      .bloom-stage .bloom { inset: 6% 8%; }
      .stage-art { position: absolute; top: 50%; left: 50%; translate: -50% -50%; width: 128%; height: auto; max-width: none; mix-blend-mode: multiply; pointer-events: none; }

      .chip {
        position: absolute;
        z-index: 2;
        background: var(--surface);
        border-radius: 999px;
        padding: 10px 20px;
        font-weight: 600;
        font-size: 1.05rem;
        box-shadow: 0 12px 28px rgba(26, 16, 51, 0.12);
        animation: float 6s ease-in-out infinite alternate;
      }
      .chip::before { content: ""; display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--coral); margin-inline-end: 9px; }
      .chip-1 { top: 14%; left: 6%; }
      .chip-2 { top: 40%; left: 0; animation-delay: -2s; }
      .chip-2::before { background: var(--teal); }
      .chip-3 { bottom: 16%; left: 5%; animation-delay: -4s; }
      .chip-3::before { background: var(--violet); }
      .chip-4 { top: 18%; right: 4%; animation-delay: -1s; }
      .chip-4::before { background: var(--yellow); }
      .chip-5 { top: 47%; right: 0; animation-delay: -3s; }
      .chip-5::before { background: var(--violet); }
      .chip-6 { bottom: 13%; right: 8%; animation-delay: -5s; }
      .chip-6::before { background: var(--teal); }
      @keyframes float { from { translate: 0 -7px; } to { translate: 0 7px; } }
      @media (min-width: 761px) { .chips { display: none; } }
      @media (max-width: 760px) {
        .stage-art { display: none; }
        .chip { font-size: 0.92rem; padding: 8px 15px; }
        .chip-2, .chip-3, .chip-4, .chip-5 { display: none; }
        .chip-1 { top: 9%; left: 0; }
        .chip-6 { bottom: 20%; right: 0; }
      }

      .phone {
        position: relative;
        width: min(320px, 80vw);
        margin: 0 auto;
        padding: 10px;
        border-radius: 50px;
        background: var(--ink);
        box-shadow: 0 40px 90px rgba(26, 16, 51, 0.3);
      }
      .phone::before { content: ""; position: absolute; top: 22px; left: 50%; translate: -50% 0; width: 86px; height: 24px; border-radius: 999px; background: var(--ink); }
      .phone-screen {
        height: 560px;
        border-radius: 40px;
        background: var(--canvas);
        padding: 66px 16px 24px;
        display: flex;
        flex-direction: column;
        text-align: left;
        overflow: hidden;
      }
      .phone .pick { justify-content: center; font-size: 0.9rem; }
      .phone .pill { padding: 8px 16px; }
      .feed { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
      .feed-item {
        display: grid;
        gap: 4px;
        background: var(--surface);
        border-radius: 22px 22px 22px 6px;
        padding: 14px 16px;
        box-shadow: 0 10px 24px rgba(26, 16, 51, 0.07);
        opacity: 0;
        animation: feed-1 11s ease-in-out infinite;
      }
      .feed-item strong { font-size: 1.12rem; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; }
      .feed-item span { color: var(--ink-soft); font-size: 0.86rem; }
      .feed-2 { animation-name: feed-2; }
      .feed-3 { animation-name: feed-3; }
      @keyframes feed-1 { 0%, 3% { opacity: 0; translate: 0 14px; } 8%, 90% { opacity: 1; translate: 0 0; } 96%, 100% { opacity: 0; translate: 0 -8px; } }
      @keyframes feed-2 { 0%, 30% { opacity: 0; translate: 0 14px; } 35%, 90% { opacity: 1; translate: 0 0; } 96%, 100% { opacity: 0; translate: 0 -8px; } }
      @keyframes feed-3 { 0%, 57% { opacity: 0; translate: 0 14px; } 62%, 90% { opacity: 1; translate: 0 0; } 96%, 100% { opacity: 0; translate: 0 -8px; } }

      .listen { display: flex; align-items: center; justify-content: center; gap: 18px; }
      .mic-wrap { display: grid; place-items: center; }
      .mic-wrap > * { grid-area: 1 / 1; }
      .mic-wrap .mic-pulse { background: var(--coral); }
      .mic-wrap .mic-btn-live { width: 68px; height: 68px; background: var(--coral); color: #FFFFFF; box-shadow: 0 12px 26px rgba(255, 90, 78, 0.4); }
      .mic-wrap .mic-pulse { width: 68px; height: 68px; }

      .eq { display: flex; align-items: center; justify-content: center; gap: 5px; height: 26px; }
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
      .pick-arrow { color: var(--coral); display: grid; animation: nudge 1.6s ease-in-out infinite; }
      @keyframes nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }

      .mic-btn { width: 84px; height: 84px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; color: var(--ink); box-shadow: 0 12px 26px rgba(26, 16, 51, 0.14); z-index: 1; }
      .pick-arrow svg { width: 22px; height: 22px; }
      .mic-btn svg { width: 32px; height: 32px; }

      .icon-tile { width: 52px; height: 52px; border-radius: 17px; display: grid; place-items: center; margin-bottom: 14px; flex: 0 0 auto; }
      .icon-tile svg { width: 26px; height: 26px; }
      .tone-coral { background: #FFE9E4; color: #D63A2E; }
      .tone-teal { background: #DDF5F3; color: #12827E; }
      .tone-violet { background: #ECE6FB; color: #6543CC; }
      .tone-yellow { background: #FFF1D6; color: #A86A00; }
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
        padding: 14px 14px 30px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        color: var(--ink);
        text-decoration: none;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .use-case-link:hover { transform: translateY(-3px); box-shadow: 0 22px 44px rgba(26, 16, 51, 0.09); }
      .use-case-link strong { font-size: clamp(1.5rem, 3vw, 1.9rem); font-weight: 600; line-height: 1.12; letter-spacing: -0.02em; }
      .use-case-link > strong, .use-case-link > span { padding: 0 18px; }
      .use-case-link > span { color: var(--ink-soft); max-width: 32em; }

      .scene { position: relative; aspect-ratio: 16 / 10; border-radius: 20px; overflow: hidden; margin-bottom: 14px; background: var(--canvas); }
      .scene img { width: 100%; height: 100%; object-fit: cover; display: block; transition: scale 0.6s cubic-bezier(0.2, 0.7, 0.2, 1); }
      .use-case-link:hover .scene img { scale: 1.04; }
      .go {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: var(--surface);
        color: var(--ink);
        display: grid;
        place-items: center;
        box-shadow: 0 8px 18px rgba(26, 16, 51, 0.1);
        transition: transform 0.25s, background 0.25s, color 0.25s;
      }
      .go svg { width: 20px; height: 20px; }
      .use-case-link:hover .go { transform: rotate(-35deg); background: var(--ink); color: #FFFFFF; }

      .value { display: grid; gap: 8px; align-content: start; justify-items: start; }

      .price-card { position: relative; overflow: hidden; display: grid; gap: 6px; align-content: start; justify-items: start; }
      .price-card > * { position: relative; }
      .price-card .bloom { position: absolute; inset: -30% -30% 35% 35%; opacity: 0.5; }
      .price-card-featured .icon-tile { background: rgba(255, 255, 255, 0.12); color: var(--yellow); }
      .price-card p:last-child { color: var(--ink-soft); }
      .price { font-size: 2.3rem; font-weight: 600; letter-spacing: -0.03em; margin: 10px 0 6px; }
      .price span { font-size: 1rem; font-weight: 400; letter-spacing: 0; color: var(--ink-soft); }
      .price-card-featured { background: var(--ink); border-color: var(--ink); color: #FFFFFF; }
      .price-card-featured p:last-child, .price-card-featured .price span { color: #C9C3DB; }
      .pricing-note { color: var(--ink-soft); font-size: 0.9rem; margin-top: 24px; }

      /* Use-case landing pages */
      .landing-art { float: right; width: min(46%, 480px); height: auto; margin: -32px 0 24px 40px; border-radius: 28px; }
      @media (max-width: 800px) { .landing-art { float: none; width: 100%; margin: 0 0 32px; } }
      .landing-copy::after { content: ""; display: block; clear: both; }
      .landing-copy > p { color: var(--ink-soft); font-size: 1.15rem; max-width: 40em; margin-top: -24px; }
      .landing-examples ul { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; list-style: none; margin: 0; padding: 0; }
      @media (max-width: 800px) { .landing-examples ul { grid-template-columns: 1fr; } }
      .landing-examples li { font-weight: 500; }
      .landing-steps { list-style: none; margin: 28px 0 0; padding: 0; font-weight: 500; display: grid; gap: 12px; counter-reset: step; line-height: 1.4; }
      .landing-steps li { counter-increment: step; display: flex; align-items: center; gap: 14px; }
      .landing-steps li::before { content: counter(step); flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-weight: 600; background: #FFE9E4; color: #9E2C24; }
      .landing-steps li:nth-child(2)::before { background: #DDF5F3; color: #0A615E; }
      .landing-steps li:nth-child(3)::before { background: #ECE6FB; color: #6543CC; }

      /* Closing CTA */
      .cta {
        position: relative;
        overflow: hidden;
        margin-top: clamp(88px, 12vw, 144px);
        padding: clamp(72px, 11vw, 128px) 24px;
        border-radius: 40px;
        background: var(--ink);
        color: #FFFFFF;
        text-align: center;
      }
      .cta h2 { position: relative; margin: 0 auto; }
      .cta .hero-actions { position: relative; }
      .cta .bloom { inset: 35% 5% -45%; opacity: 0.6; }
      .cta .store-button-secondary { box-shadow: none; }

      /* Scroll reveals, where the browser supports scroll-driven animation */
      @keyframes reveal { from { opacity: 0; translate: 0 32px; } to { opacity: 1; translate: 0 0; } }
      @supports (animation-timeline: view()) {
        @media (prefers-reduced-motion: no-preference) {
          .section > h2, .step, .use-case-link, .value, .price-card, .landing-copy > p, .landing-steps, .landing-examples li, .cta {
            animation: reveal linear both;
            animation-timeline: view();
            animation-range: entry 5% entry 45%;
          }
        }
      }

      @media (prefers-reduced-motion: reduce) {
        html { scroll-behavior: auto; }
        *, *::before, *::after { animation: none !important; transition: none !important; }
        .cap-line, .feed-item { opacity: 1; }
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
        padding: 48px 0;
        border-top: 1px solid var(--line);
        text-align: center;
        font-size: 0.92rem;
        color: var(--ink-soft);
      }
      .footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 22px; margin-bottom: 18px; font-weight: 500; }
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
        &copy; 2026 Q9 Labs. Murmur is a privacy-first AI translation service.
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
