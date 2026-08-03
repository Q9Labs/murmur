The current App Store screenshot set pairs seven verified iPhone app captures with Imagegen-created Murmur compositions. Each composition contains its exact benefit headline, abstract visual direction, and a device-frame placeholder; the build script replaces that placeholder with the untouched verified app capture. No generated product UI appears in the submitted frames.

Run `node tooling/scripts/build-store-screenshots.mjs` from the repository root to reproduce the set. The immutable source captures live under `store-assets/source/screenshots/ios/`.

The first screenshot uses a real committed translated-caption state. A future capture pass should replace it with a longer Continuous Mode session from the current default interface before store publication; do not fabricate that state in the frame generator.
