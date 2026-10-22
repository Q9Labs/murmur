# Native capture regression

Run on macOS with Xcode, under the machine's shared heavy-job admission lock:

```sh
python3 tooling/ios-capture/tests/check.py
python3 tooling/ios-capture/tests/check.py --baseline origin/master
```

The first command must pass. Against the parent of this fix, the second command
must fail: capture continues after voice processing fails in a graph without
hardware input. The fixed code must return a Swift error without starting capture.

The runner compiles the production capture graph method with real AVFoundation.
It replaces only the iOS-only session activation with an empty route fixture and
uses offline rendering, so it does not request microphone access. The actual session and graph method also passes an iOS SDK compile check.
It runs the production format validator and real audio converter with zero-rate,
zero-channel, mono, and stereo formats. Each executable has a 30-second deadline.

This is not a physical reproduction of the production iPhone crash. It does not
prove which route transition supplied the invalid format, exercise AVAudioSession
activation on iOS, or prove capture on a real microphone. An iPhone route test is
still needed. The failure message reports setup step, negotiated rate/channels,
input port type, voice-processing state, and native error domain/code only.
