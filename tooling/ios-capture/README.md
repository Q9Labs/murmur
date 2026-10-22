# Native capture regression

Run on macOS with Xcode, under the machine's shared heavy-job admission lock:

```sh
python3 tooling/ios-capture/tests/check.py
python3 tooling/ios-capture/tests/check.py --baseline e1cdeba3d2f2e7af9cec4b0793fd389efdf5f084
python3 tooling/ios-capture/tests/check.py --baseline 358db8a2c9b7150f61a69285c028a9f48c0821be
```

The first command must pass. The second must fail because the original setup
installs a tap with populated output even though the hardware input is unavailable.
The third command must fail all eight session-operation/scenario regressions because
that revision does not retain diagnostics when a session API throws.

The runner compiles the actual production setup, retry/reset, and state-payload
methods. A real AVFoundation offline graph checks voice-processing failure without
requesting microphone access. A separate hardware seam supplies unavailable input
with populated output and voice processing already enabled. It checks both retries,
no tap/converter/start on failure, invalid negotiated output, and clearing stale
failure details after successful setup. Formats and converters are real AVFoundation;
the seam's engine/node operations are fixtures, not physical hardware.

A session seam executes the unchanged production session calls and injects failures
at category, preferred sample rate, preferred buffer duration, and activation. Each
operation fails on both attempts, and separately after the first attempt fails in
the graph. Tests require the final failure step, no input-node or graph access for
the failed session attempt, normal cleanup, and recovery on a later successful start.
Session APIs are fixtures for execution; the iOS SDK type check uses the actual APIs.

The actual native state dictionary serializes to the committed hardware and session JSON fixtures used by
the capture reporting tests. Those tests call the production startup/reporting path
and privacy sanitizer, including malformed fields and unknown user-content fields.
The runner also type-checks the actual iOS session/setup APIs and tests zero formats
and mono/stereo PCM conversion. Each compiler/executable has a 30-second deadline.

This does not reproduce the production iPhone crash, drive an Expo bridge on a
physical phone, prove successful microphone capture, or establish compatibility
with unsupported voice-processing routes. A real iPhone route test remains needed.
