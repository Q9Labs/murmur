The current five-image set pairs verified Android app captures with Imagegen-created Murmur compositions. Each composition supplies the exact benefit headline and abstract visual direction; the build script replaces its device placeholder with the untouched verified app capture. Run `node tooling/scripts/build-store-screenshots.mjs` from the repository root to reproduce the en-US set and its mirrored en-GB copy.

The immutable source captures live under `store-assets/source/screenshots/android-captures/`. The first two generated images contain real committed translation states; the remaining images show direction setup, microphone disclosure, and onboarding.

A future capture pass should add a longer live-caption session from the current default interface before store publication. The generated composition may establish a verified use case, but the underlying product screen must remain a real capture.
