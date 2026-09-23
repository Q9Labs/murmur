# Option B store screenshot system

Option B is the approved production direction. Options A and C remain archived in `store-screenshot-concepts/` for future exploration.

The 12 bases (`ios/ios-01..07.png`, `android/android-01..05.png`) were generated with the built-in Imagegen tool. Every base uses a near-black `#171319` field, one coral `#FF746A` shape, and restrained teal `#4DD8BF` and gold `#F8C552` lines. A front-facing phone contains a chroma-green placeholder.

The bases carry no text. For 1.3.0 the originally baked headlines were removed so one base can serve every store locale. `tooling/scripts/build-store-screenshots.mjs` replaces the placeholder with a rounded, untouched native capture, then renders the headline from `tooling/scripts/store-screenshot-headlines.mjs` in the band above the phone (right-aligned for Arabic and Urdu), and exports an opaque sRGB PNG.

No composition may contain people, hands, silhouettes, faces, lifestyle photography, flags, ratings, awards, badges, watermarks, store logos, fake app UI, or unsupported product claims.

## Headlines

One short, plain line per screenshot, with no subtext, prices, or AI vendor names. English:

| # | iOS | Android |
| --- | --- | --- |
| 1 | Two-way live translation. | Two-way live translation. |
| 2 | Choose your languages. | Choose your languages. |
| 3 | Hear translations aloud. | Translate phone audio. |
| 4 | Listens in the background. | Listens in the background. |
| 5 | Go Pro, or get a Trip Pass. | Go Pro, or get a Trip Pass. |
| 6 | Your audio isn't kept. | Your audio isn't kept. |
| 7 | Start free. No account. | Start free. No account. |
| 8 | Murmur, in your language. | Murmur, in your language. |

## Imagegen prompt contract for new bases

Use case: `ads-marketing`. Render no text. Use a premium, minimal, near-black editorial composition that leaves the upper band empty for the headline. Place one perfectly front-facing dark-metal phone below it. Keep the full inner display as one bright chroma-green rounded rectangle with no UI, icons, text, reflection, gradient, notch, or camera cutout. Vary only the coral field and thin teal/gold accents while retaining the same visual system. Use the 1320:2868 ratio for iOS and 1080:1920 for Android.
