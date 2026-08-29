# Murmur Growth and ASO Strategy

<!-- cspell:words GITEX Interprefy Reportal Wordly -->

Murmur should launch Gulf-first with one clear promise: follow spoken language live through translated captions. Travelers on tours and attendees listening to talks share that job, so the product can serve both without becoming a generic travel translator or an event platform. The default listing should speak to tours and talks, while separate store pages and ad creative should make each setting feel specific.

The launch order should be the United Arab Emirates, Saudi Arabia, then Qatar. The UAE offers the best first test because it combines a large international audience, concentrated business events, high social-media reach, and Murmur's existing English-to-Arabic product path. Saudi Arabia offers a much larger second market, while Qatar provides a smaller, event-heavy validation market.

## What the evidence supports

Dubai welcomed 19.59 million international overnight visitors in 2025, with visitors spread across Western Europe, the GCC, the Middle East and North Africa, CIS and Eastern Europe, South Asia, and other regions. Dubai World Trade Centre reported 2.65 million event participants in 2024, and Dubai secured 437 future business events that year. This is a large, concentrated audience that regularly encounters spoken-language gaps in tours, exhibitions, talks, and hospitality. [Dubai tourism performance](https://www.dubaidet.gov.ae/en/newsroom/press-releases/dubais-tourism-industry-achieves-third-successive-record-breaking-year?print=), [Dubai event performance](https://www.mediaoffice.ae/en/news/2025/march/20-03/dwtc-dubai-global-leadership-in-business-events)

Saudi Arabia recorded about 30 million inbound tourists in 2024, up 8 percent from 2023. It also had about 15.7 million non-Saudi residents in 2024, or 44.4 percent of the population, so language assistance is useful beyond short tourist visits. [Saudi tourism statistics](https://www.spa.gov.sa/N2344210), [Saudi population estimates](https://www.stats.gov.sa/documents/20117/2435273/Population%2BEstimates%2BPublication%2B2024%2BEN.pdf/7d123c57-1626-7d2f-ba7f-8a719f928f28?t=1750142166351)

Qatar welcomed 5.08 million visitors in 2024 and reported more than one million international business visitors in 2025. Its volume is smaller, but its event concentration makes it a useful third market for the talk-attendee positioning. [Qatar 2024 tourism performance](https://www.qatartourism.com/en/news-and-media/press-releases/2024-year-of-milestones-for-qatar-tourism), [Qatar 2025 tourism performance](https://www.qatartourism.com/en/news-and-media/press-releases/qatar-tourism-marks-2025-as-a-year-of-global-milestones-and-resi)

The UAE's official language is Arabic, while English, Hindi, Russian, Chinese, French, Urdu, Bengali, Malayalam, Farsi, and other languages are also used across public life and expatriate communities. Murmur's language set matches much of that demand, but the app interface itself is currently English-only. The first campaign should therefore target English-speaking visitors and residents who need captions from Arabic or another supported language. Arabic-speaking acquisition should wait until the interface, onboarding, permission copy, errors, and support surfaces have a verified Arabic localization. [UAE language and population profile](https://u.ae/en/about-the-uae/fact-sheet)

## Current baseline

The live listings do not yet have enough traffic to support statistical ASO decisions. A read-only console audit on July 30, 2026 showed:

| Store | Current signal | Consequence |
| --- | --- | --- |
| App Store, previous 90 days | 355 impressions, 9 product-page views, 5 first-time downloads, and a displayed 2.27 percent average conversion rate | Source, territory, retention, and product-page reports are below Apple's reporting thresholds. |
| Google Play, previous 28 days | 419 device impressions, 11 listing visitors, 1 acquisition, and no first-open or retention data | The listing-level conversion result is suppressed, so the 3.7 percent overview figure is not reliable enough for a decision. |
| Ratings and reviews | No public rating summary on either store | Murmur has no trust signal in search results or on its product pages. |
| Experiments | No App Store product page or Play listing experiments | There is no creative learning history. |
| Product analytics | Content-free mobile and Worker events pass through a strict Worker schema to PostHog US | Activation, latency, retention, quality proxies, failures, and direct tagged launches can be measured without sending captions or audio. |

The public App Store listing is in Utilities and exposes only English as the interface language. The Google Play listing shows `1+` downloads. The previous screenshot sets were removed intentionally because they did not explain a use case or show the rolling-caption experience that differentiates Murmur. The replacement set is pending redesign.

A July 30, 2026 snapshot of Apple's public Search API found Murmur first for its exact brand query, but it did not appear among roughly 180–193 returned results for sampled non-brand queries such as `voice translator`, `live translator`, `Arabic translator`, `مترجم صوتي`, and `ترجمة صوتية` in the UAE, Saudi Arabia, and Qatar. This is a visibility baseline rather than keyword-volume data. Apple's own discovery guidance confirms that search ranking combines text relevance with customer behavior, including downloads and the number and quality of ratings and reviews. [Apple App Store discovery](https://developer.apple.com/app-store/discoverability/)

## Competitive position

Murmur cannot win by claiming to be a broader translator. Google Translate offers text, camera, offline, conversation, and near-real-time transcription across up to 249 languages, while iTranslate combines voice, text, camera, phrasebooks, and offline use with more than 500,000 US App Store ratings. Apple Translate is free, built into the platform, supports offline conversation, and now offers live translation with supported AirPods and iPhones. [Google Translate listing](https://apps.apple.com/us/app/google-translate/id414706506), [iTranslate listing](https://apps.apple.com/us/app/itranslate-translator/id288113403), [Apple Translate listing](https://apps.apple.com/us/app/translate/id1514844618), [AirPods Live Translation](https://support.apple.com/en-ie/123185)

Conference translation products solve a different problem. Wordly, KUDO, and Interprefy provide organizer-managed sessions, participant feeds, event access, integrations, and translated audio or captions. They are stronger for a planned event with a direct audio feed, but they add organizer setup, access links or tokens, and enterprise buying. Murmur's opening is the attendee who wants to listen immediately without waiting for the organizer to provide translation. [Wordly event workflow](https://www.wordly.ai/translation-software), [KUDO Live listing](https://apps.apple.com/us/app/kudo-live/id1380613475), [Interprefy listing](https://apps.apple.com/us/app/interprefy/id971176635)

The defensible position is:

> Live translated captions for the person in front of you, from a quick exchange to a full talk.

This position works for a guide or conference speaker and does not imply camera translation, offline use, automatic two-way conversation, organizer controls, or professional human interpretation.

## Store strategy

The repository-owned English metadata should use the following search structure:

| Surface | Copy or role |
| --- | --- |
| App name/title | `Murmur: Live Voice Translator` |
| App Store subtitle | `Captions for travel & talks` |
| App Store keyword field | `interpreter,conference,meeting,event,tour,lecture,arabic,urdu,hindi,spanish,french,german,transcribe` |
| Google Play short description | `Live translated captions with 30 free minutes each month. No sign-up needed.` |
| Primary message | Follow ongoing speech in another language through live captions. |
| Trust message | Start without sign-up; no saved cloud transcript history by default. |
| Supporting message | Live sessions handle short exchanges, tours, lectures, talks, and other ongoing speech. |

The App Store keyword field avoids repeating exact words already present in the name and subtitle, which leaves room for use cases and language terms. The public Apple search snapshot suggests the English clusters `voice translator`, `live translator`, `speech translator`, `real time translation`, and `Arabic translator`, plus the Arabic clusters `مترجم صوتي`, `ترجمة صوتية`, and `ترجمة مباشرة`. Real Apple Ads popularity and bid data are still required before assigning spend; the CollabEZ Apple Ads account has not been created.

The App Store primary category should be evaluated for a move from Utilities to Travel, with Utilities as the secondary category. Travel fits the first acquisition wedge and makes browse placement more relevant, but the change should be made only with the next reviewed version and checked against the final positioning. Apple treats the primary category as a discoverability input. [Apple product page guidance](https://developer.apple.com/app-store/product-page/)

English should remain the only localized listing until the app interface supports another language. The product-localization order should be Arabic first, then Hindi and Urdu, because those languages address both Gulf residents and visitors. Store copy, screenshots, onboarding, permission context, errors, privacy explanations, and support must be translated as one release; a localized listing that opens into an English-only app would raise conversion at the cost of failed activation and poor ratings.

### Screenshot order

The first three screenshots need to show value before setup:

1. **Follow every word in your language.** Show a real Arabic-to-English talk session with enough committed captions to make the result obvious.
2. **Live captions while the speaker keeps talking.** Show the rolling caption timeline and the source-to-target language pair.
3. **Built for tours, talks, and lectures.** Show the phone in the attendee context, using a real product capture inside the device frame.
4. **Short exchange or ongoing speech.** Show the live caption flow without implying a two-way conversation feature.
5. **15 supported languages, including Arabic.** Show the language picker with accurate availability.
6. **Translated speech when available.** Show translated audio without making speech output look more reliable than captions.
7. **30 free minutes. No saved transcript history.** Explain the free allowance and privacy benefit in plain language.

Every screenshot must use the current shipping interface and a successful real caption session. Marketing overlays may clarify the benefit, but the underlying app state cannot be fabricated. The Android feature graphic should use the same first message rather than a generic logo composition.

Once traffic exists, create two App Store custom product pages and two Google Play custom store listings:

- **Tours and travel:** language selection, short phrases, guides, directions, and translated speech.
- **Talks and conferences:** rolling captions, long speech, and privacy.

Apple allows custom product pages to use their own screenshots, promotional text, and keywords, while Google Play can target custom listings by country, ad group, URL, and known search keywords. This gives each audience a specific page without weakening the default product definition. [Apple custom product pages](https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions/), [Google Play custom store listings](https://support.google.com/googleplay/android-developer/answer/9867158)

Do not start a store A/B test at the current volume. Apple and Google both provide native product-page experiments, but a test with a few visitors will remain inconclusive. Drive one coherent listing to at least hundreds of qualified visitors first, then test the first screenshot or icon one variable at a time. [Apple product page optimization](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/)

## Acquisition plan

Paid acquisition should create qualified caption sessions, not cheap installs. Store algorithms consider customer behavior, ratings, engagement, and technical quality, so low-intent installs that never complete a translation can weaken the signals Murmur needs. Google explicitly includes metadata, user feedback, engagement, technical performance, and user experience in discovery and ranking. [Google Play discovery and ranking](https://support.google.com/googleplay/android-developer/answer/9958766)

The initial media split for each test budget should be:

- 40 percent Google App campaigns, because Android leads Gulf mobile usage and Google can cover Search, Play, YouTube, Discover, and Display.
- 25 percent Apple Ads search results, because the query reveals intent and Apple Ads is available in the UAE, Saudi Arabia, Qatar, Bahrain, Kuwait, and Oman.
- 20 percent creator production and partnership posts, because real demonstrations explain live captions better than a static claim.
- 15 percent Meta app-promotion tests after qualified-session measurement exists.

[Google App campaigns](https://support.google.com/google-ads/answer/6247380), [Apple Ads availability](https://ads.apple.com/app-store/countries-and-regions), [Meta app campaigns](https://www.facebook.com/business/ads/meta-advantage-plus/app-campaigns)

Start in the UAE with separate traveler and talk-attendee asset groups. Do not combine them inside one ad:

- **Traveler hook:** “Your guide is speaking Arabic. Follow every word in English.”
- **Talk hook:** “The speaker uses another language. Read the talk live on your phone.”
- **Trust hook:** “No sign-up. No saved transcript history.”
- **Product proof:** show source speech becoming committed translated captions in the shipping app.

Instagram and TikTok creative should be native 9:16 video, recorded with sound, subtitles, and the product message inside the safe area. Meta reports that Reels campaigns using 9:16 video with audio and safe-zone messaging delivered a lower cost per result than image-only variants in its cited tests. The UAE is suitable for this format: Meta's own planning data, as reported by DataReportal, estimated 7.6 million Instagram users in the country in early 2025. [Meta Reels guidance](https://www.facebook.com/business/ads/facebook-instagram-reels-ads), [UAE digital audience](https://datareportal.com/reports/digital-2025-united-arab-emirates)

Partnership distribution should focus on moments where the need already exists:

- Give tour operators and guides a trackable QR code linked to the travel product page.
- Offer conference exhibitors, community stages, and workshop hosts a QR card for attendees when the organizer does not provide interpretation.
- Place a one-line install prompt in attendee emails, event apps, booth cards, hotel concierge material, and tour confirmation messages.
- Ask Gulf travel creators to record a real Arabic-to-English tour or talk demo, then reuse the best creator post as paid creative with permission.

GITEX Global, scheduled for December 7–11, 2026 at Expo City Dubai, is a strong public field test because it combines international visitors, dense talks, and a tech-literate audience. Murmur should seek an attendee-facing pilot or partner activation rather than present itself as the event's interpretation service. [GITEX Global 2026](https://www.gitex.com/about)

The marketing site should add focused, indexable pages for:

- live translated captions for travel;
- live translation for talks and lectures;
- English-to-Arabic live captions;
- Arabic-to-English live captions;
- a page for short exchanges and ongoing speech.

Each page should show a real demo, name the supported languages and limits, link to the matching store page with a page-specific store campaign identifier, and avoid claims about offline use, two-way conversation, emergency interpretation, or professional accuracy. These parameters provide store-console attribution. Murmur's in-app session attribution is limited to direct tagged app launches until a privacy-reviewed deferred-link system exists.

## Product work that affects ranking

ASO copy will not compensate for failed activation. The following product changes have direct growth value:

1. **Use first committed translation as activation.** Store download counts alone cannot distinguish curiosity from product value, so activation occurs only after Murmur commits a translated caption.
2. **Maintain privacy-conscious acquisition events.** Record first open, onboarding completion, session start, first committed caption, successful session end, language pair, session duration, non-content error code, and normalized campaign source. Keep the install identifier hashed and never send raw audio or caption text to analytics.
3. **Add a rating prompt after success.** Ask only after several successful sessions and never while the microphone is active or after an error. Apple recommends requesting a review after a completed task when the user is likely to feel satisfied. [Apple ratings and reviews](https://developer.apple.com/app-store/ratings-and-reviews/)
4. **Localize the whole interface into Arabic.** Verify right-to-left layout, native copy, permission context, language names, caption rendering, support, and real Arabic speech before buying Arabic-language installs.
5. **Expose a simple share path.** After a successful ended session, let the user share Murmur's store link with a short use-case message. Do not share captions unless the product later adds an explicit, privacy-reviewed export.
6. **Protect technical quality.** Track caption success, startup failures, crashes, ANRs, and translation latency by version and language pair. Google states that user-perceived crash and ANR rates affect discoverability. [Google Play crashes and ANRs](https://support.google.com/googleplay/android-developer/answer/9859174)

The core funnel should be:

```text
store impression
  -> product-page visit
  -> install
  -> first open
  -> onboarding complete
  -> microphone granted
  -> first committed caption
  -> qualified session
  -> second successful session
  -> rating or referral
```

Report every stage by store, country, campaign, product page, language pair, and short versus ongoing speech. For a situational travel utility, day-seven retention alone can understate value, so pair it with qualified activation, second successful session, caption success rate, and cost per qualified session.

## Execution sequence

Before paid spend:

1. Publish the revised English metadata with current, benefit-led screenshots.
2. Verify activation analytics, the success-timed rating prompt, and campaign attribution without collecting caption content.
3. Verify real English-to-Arabic and Arabic-to-English sessions on current iOS and Android builds in quiet speech, background noise, a tour-like setting, and a talk from several meters away.
4. Run moderated tests with at least ten travelers and ten talk attendees, then fix repeated onboarding or caption failures before using their behavior as an acquisition benchmark.

For the UAE learning launch:

1. Create traveler and talk-attendee custom store pages.
2. Create the Apple Ads account and use actual keyword popularity and bid guidance to narrow the sampled keyword map.
3. Launch small Apple and Google campaigns with separate use-case assets.
4. Publish six real demo videos across traveler, talk, language-pair, and privacy hooks.
5. Recruit tour and event partners using unique QR links.
6. Review cost per qualified session and caption success weekly; pause an audience or language pair when installs do not activate.

Scale to Saudi Arabia and Qatar only after the UAE funnel has enough volume to show which use case activates and returns. Arabic-language acquisition additionally requires the verified Arabic product localization. App Store and Play listing experiments should begin only after each treatment can receive enough traffic to reach a useful result.

## Live actions still requiring explicit execution approval

The repository contains the revised English metadata and this plan, but the following actions change external state or spend money and were not performed during the research pass:

- creating the CollabEZ Apple Ads account, which submits legal-entity and primary-contact information;
- publishing metadata, screenshots, categories, custom pages, or experiments to either live store;
- adding billing details or launching Apple, Google, Meta, Instagram, or TikTok campaigns;
- contacting GITEX, tour operators, creators, conference organizers, hotels, or other partners;
- publishing website pages or deploying Worker changes;
- advertising in Arabic before the app interface has a verified Arabic localization.
