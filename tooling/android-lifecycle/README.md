<!-- cspell:ignore lifecycletests -->
# Android capture lifecycle regression tests

This small native app compiles the production foreground service, bridge, overlay,
and caption window directly. It does not load Expo, contact a backend, or record
microphone audio. The activity only makes foreground-service startup eligible.

Requirements: JDK 17, Gradle 8.14.3, Android SDK 35, and a connected Android 12
(API 31) emulator or test device. Set `ANDROID_HOME` and, when needed,
`ANDROID_SERIAL` to the intended test device.

```sh
gradle -p tooling/android-lifecycle --no-daemon installDebug installDebugAndroidTest
adb shell pm grant ai.q9labs.murmur.lifecycletests android.permission.RECORD_AUDIO
gradle -p tooling/android-lifecycle --no-daemon connectedDebugAndroidTest
```

The tests cancel startup before service callbacks can run, from both the main
thread and a module-like worker thread. They also check cancellation before
playback projection setup, a new microphone start after cancelled playback, and a
normal stop after foreground promotion. Cancelled
starts remain alive beyond the platform transition deadline, so a delayed system
crash fails instrumentation rather than being hidden by an early test exit.

Results are under `build/reports/androidTests/connected/`. This proves native
service lifecycle behavior, not full-app translation, audio routing, or the
causal path of any particular production event.
