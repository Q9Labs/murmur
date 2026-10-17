# Caption recovery: longer speech and playback

All audio here is synthetic. No production service was called or changed.

## Timing rule

Two direct OpenAI runs used the same 20-second continuous English clip, Spanish output, `near_field`, and no source transcription. Audio-to-first-caption delays were 0 and 2,320 ms. The latter healthy stream exceeds the former 2,000 ms watchdog. An initial ten-run sandbox batch measured 229–2,059 ms, median 1,204 ms, p95/max 2,059 ms, with captions and zero retries in all ten. The final-build replication (sandbox version `15174f45-14a9-49a2-aa85-a86eca2dbc2a`) had captions in 10/10 runs and zero retries: signed audio-to-caption delays −8,492–4,158 ms, median 1,604.5 ms, p95/max 4,158 ms. Run seven received captions before audio. Input-to-caption median was 2,684.5 ms and p95/max 5,290 ms. With only ten trials per batch, nearest-rank p95 equals the maximum.

The first watchdog now waits 10 seconds after the first output audio delta: more than twice the largest healthy delay observed in the final long-speech replication. A replacement gets 20 seconds plus its buffered-input replay duration at 4x. `captions_recovered` means the first nonempty caption arrived on a replacement; it does not prove the original could never have delivered a later caption. This is an empirical margin, **not an OpenAI delivery guarantee**. Longer speech, other languages, and different speakers can behave differently.

Timing uses client event receipt, not a provider-internal clock. Negative audio-to-caption offsets remain negative rather than being silently clamped. Every sandbox trial sent 960,000 PCM bytes in 200 frames, had 200 acknowledgements, received Spanish captions and audio, and had no errors. Final-build last input acknowledgements arrived 20.420–20.461 seconds after input start. Provider delivery and network transit dominate this measurement; it is not a CPU throughput comparison. During the run, the 10-core host had 80% CPU idle and no swap activity; other workloads were present. The free narration render briefly shared that host. The raw local event records retain all input acknowledgement timings.

## Playback policy

Every replacement replays a complete input prefix. The Worker tracks the unique output PCM duration across connections and discards that prefix from replacement audio, including partial frames. It still forwards the missing captions. The timeline advances while playback is muted too, so enabling playback cannot rewind it. If every prior frame is below the existing PCM audibility threshold, no translated speech was heard; that quiet-only prefix does not suppress replacement speech. A live short-clip probe exposed this distinction: its initial output had RMS 2.379, and suppressing it hid the recovered voice. On the final build, a second live recovery had quiet initial RMS 2.372 and audible replacement RMS 684.032, with captions after one retry at 12,331 ms. The earlier first-voice-suppression bug no longer occurred.

This policy aligns **audio duration**, not words. Neural regeneration can change timing or wording; exact semantic alignment is not guaranteed. If input exceeds the complete 30-second buffer, recovery stops, pending replacement opens abort, and the current connection remains alive. Replaying a rolling suffix against a full-session output offset would be unsafe.

The workerd fixture derives a deterministic marker from each input frame, following Astra's reproduction. The new assertion fails on `fd0f8c8`: markers 16–25 play twice. With the fix, every marker and the later live marker 32 play once, even after the two-attempt cap. A separate quiet-output case proves that the recovered audible markers still play once. The healthy 2.5-second assertion also fails on `fd0f8c8` (three connections instead of one) and passes with zero retries and `captions_recovered=false`.

## Reproduce the synthetic fixture

On macOS, with `ffmpeg` installed:

```sh
say -v Samantha -r 170 -f speech.txt -o speech.aiff
ffmpeg -i speech.aiff -af 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse' -ar 24000 -ac 1 trim.wav
```

Read the trimmed duration with `ffprobe`. Convert the whole utterance to exactly 20 seconds using `atempo=<trimmed-duration/20>,apad`, `-t 20 -ar 24000 -ac 1 -f s16le speech.pcm`. Do not truncate words. This run's PCM size and digest are in `summary.json`. The free local ASR sample confirmed the intended landmarks before paid calls began.

With the **sandbox** already running the branch build and an isolated test ledger, run from this directory using Bun:

```sh
bun -e 'const {runSandbox}=await import("./measure-long.mjs"); for(let run=1;run<=10;run++) console.log(JSON.stringify({run,...await runSandbox(run)}));'
```

The harness is pinned to the sandbox URL, enables playback, creates a fresh anonymous test install for each session, saves playback PCM, and deletes its test account afterwards. It never accepts a production destination. `measure-short.mjs` uses the original synthetic robot PCM (89,114 bytes) and separate playback filenames. Observe a budget before rerunning; each complete replay is additional OpenAI input, even though it does not consume the user's Murmur allowance.

## Privacy boundaries

`verify-workers-log-privacy.mjs` scans every field of complete retained Cloudflare records and requires current-run positive controls. The Oort token was injected with `2password run`; it was not written to disk. These records are **not PostHog payloads**.

**Retained-log proof: FAIL, not a pass.** Three attempts returned HTTP 200 with this token, but each lacked a required current-run control. The final run passed its all-field sentinel scan, then failed because the synthetic-error control was absent (the fixture itself returned HTTP 500). A diagnostic query of that same version returned twelve complete records with zero sentinel matches. The full original logging settings and version were restored and independently read back; the disposable database returned HTTP 404. Missing controls prevent a complete retained-log privacy claim.

The workerd proof separately captures every outgoing PostHog payload, including `worker_session_ended.caption_retry_count` and `captions_recovered`, checks their expected values for recovery/quiet/cap/healthy cases, and scans complete payloads for synthetic caption and input-audio sentinels. This avoids claiming that a Cloudflare query proves PostHog contents.

All ten final long-playback ASR traces contain each translated landmark once, without a repeated passage. The recovered short clip has one caption (“Buenos días.”), but local ASR is ambiguous: the combined quiet-plus-voiced capture reads “He He”; isolating the replacement and adding 10 dB reads “Buenas noches.” once. No original translated speech existed to replay in that live recovery. Exact spoken-text agreement is **not verified**. The deterministic audible-marker fixture, rather than ambiguous short-clip ASR, proves prefix suppression for previously heard speech.

See `summary.json` for the final receipts, supplemental playback observations, spend bound, and exact sandbox-restoration result. Earlier short-clip A/B results in `../caption-retry-20261017/summary.json` describe the earlier build, not this longer watchdog.
