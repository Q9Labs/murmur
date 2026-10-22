# Native capture regression

Run on macOS with Xcode, under the machine's shared heavy-job admission lock:

```sh
python3 tooling/ios-capture/tests/check.py
python3 tooling/ios-capture/tests/check.py --baseline e1cdeba3d2f2e7af9cec4b0793fd389efdf5f084
```

The first command must pass. The second must fail because the original setup
installs a tap with populated output even though the hardware input is unavailable.

The runner compiles the actual production setup, retry/reset, and state-payload
methods. A real AVFoundation offline graph checks voice-processing failure without
requesting microphone access. A separate hardware seam supplies unavailable input
with populated output and voice processing already enabled. It checks both retries,
no tap/converter/start on failure, invalid negotiated output, and clearing stale
failure details after successful setup. Formats and converters are real AVFoundation;
the seam's engine/node operations are fixtures, not physical hardware.

The actual native state dictionary serializes to the committed JSON fixture used by
the capture reporting tests. Those tests call the production startup/reporting path
and privacy sanitizer, including malformed fields and unknown user-content fields.
The runner also type-checks the actual iOS session/setup APIs and tests zero formats
and mono/stereo PCM conversion. Each compiler/executable has a 30-second deadline.

This does not reproduce the production iPhone crash, drive an Expo bridge on a
physical phone, prove successful microphone capture, or establish compatibility
with unsupported voice-processing routes. A real iPhone route test remains needed.
