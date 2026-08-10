# Option B store screenshot system

Option B is the approved production direction. Options A and C remain archived in `store-screenshot-concepts/` for future exploration.

The 12 bases were generated one at a time with the built-in Imagegen tool. Every base uses a near-black `#171319` field, warm-cream editorial type, one coral `#FF746A` shape, and restrained teal `#4DD8BF` and gold `#F8C552` lines. A front-facing phone contains a chroma-green placeholder. The build script replaces that placeholder through its rounded mask with an untouched native capture, then exports an opaque sRGB PNG.

No composition may contain people, hands, silhouettes, faces, lifestyle photography, flags, ratings, awards, badges, watermarks, store logos, fake app UI, or unsupported product claims.

## Headline set

### iOS

1. `Translation, as it happens.`
2. `Follow spoken language live.`
3. `Choose your language.`
4. `No account. No setup.`
5. `Privacy controls, close at hand.`
6. `Read captions. Choose audio.`
7. `Set a direction. Tap Listen.`

### Android

1. `Translation, as it happens.`
2. `Follow spoken language live.`
3. `Choose your language.`
4. `No account. No setup.`
5. `Read captions. Choose audio.`

## Imagegen prompt contract

Use case: `ads-marketing` for the first asset, then `text-localization` for each sibling. Render the listed headline verbatim once with no other marketing text. Use a premium, minimal, near-black editorial composition with oversized left-aligned cream typography in the upper quarter. Place one perfectly front-facing dark-metal phone below it. Keep the full inner display as one bright chroma-green rounded rectangle with no UI, icons, text, reflection, gradient, notch, or camera cutout. Vary only the coral field and thin teal/gold accents while retaining the same visual system. Use the 1320:2868 ratio for iOS and 1080:1920 for Android.
