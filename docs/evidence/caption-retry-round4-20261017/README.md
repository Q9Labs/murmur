# Caption-only recovery

Historical round-four evidence. Round five supersedes permanent caption-source ownership; see ../caption-retry-round5-20261017/README.md.

This round supersedes the duration-alignment design at `832cc4b`. All live audio was synthetic. Only `murmur-worker-sandbox` received traffic or deployments; production was not accessed.

## Audio and caption ownership

The original OpenAI connection stays open and remains the **only** source of client audio. Recovery connections receive the same session configuration, a buffered input prefix, and then live input. Their audio, source transcripts, and configuration events never reach the client. Independent translations can differ in duration, wording, or segmentation without duplicating or suppressing playback.

The **first nonempty translation transcript wins**. An original transcript arriving before any side transcript cancels the side connection and pending recovery. A side transcript arriving first selects that side connection permanently; later original transcripts are ignored. Once captions have started, the Worker does not start another replay. This prevents a second source from repeating its prefix; it does not deduplicate repetition generated within one model stream.

The original startup watchdog starts after its first output-audio delta and waits 10 seconds. A caption-only connection gets **5 seconds plus its buffered input duration divided by four**, armed when it connects, even if it never emits audio. A separate five-second handshake timeout bounds connection establishment. At most two caption-only attempts can open. The cap does not close the original or the client.

The response floor initially exceeded the earlier healthy long-speech audio-to-caption maximum of 4.158 seconds by 842 ms. The final additional original stream increased that maximum to 5.868 seconds (first caption at 6.869 seconds), still below the original 10-second watchdog. Side timing is connect plus prefix replay plus five seconds, not five seconds after original audio: continuous input has at least a 2.5-second replay allowance when recovery starts. The direct 4× full-20-second replay produced its first caption after 1.250 seconds; both live short side connections also answered on their first attempt. No healthy long original retried. These are empirical margins, not an OpenAI delivery guarantee. Replay time is additional. A second short-clip attempt can start around 16 seconds instead of after the 25-second observation window.

Input history and each replay queue are bounded to 60 seconds of 24 kHz mono PCM16. Eviction only removes old frames; it cannot cancel a deadline or disable another attempt. History remains available for a second prefix until a caption source wins or the final attempt takes its snapshot. Recovery drains 100 ms frames at 4× speed and then fans out live input. Only the real-input path enters billing and acknowledgement accounting.

## Deterministic workerd proof

Run `pnpm verify:caption-recovery`. The fixture drives the real realtime proxy and D1-backed customer ledger in workerd; only OpenAI and PostHog are fake. It derives an audible output marker from each input frame, as in Astra's reproduction.

| Case | Failure on `832cc4b` | Caption-only result |
| --- | --- | --- |
| Shorter independent translation | The next new marker never reaches playback. | Every original marker arrives exactly once. |
| Longer independent translation | Markers 22–25 arrive twice. | Every original marker arrives exactly once. |
| Playback off, then on | Recovery replaces the original. | Muted audio stays muted; new audio plays once. |
| Silent first caption connection | No caption arrives within 25 seconds. | The second side connection supplies captions. |
| 31 seconds of continuous input | Only one retry opens. | Both attempts open; original playback continues. |
| Two silent caption connections | Only one retry opens. | The cap holds and the client stays connected. |
| Late original wins | Recovery closes the original. | Original captions continue; recovery remains false. |
| Side wins before late original | Recovery closes the original. | Only the selected side's captions arrive. |
| Healthy original at 2.5 seconds | Healthy playback already works; new counters are absent. | No recovery opens. |

The shorter/longer marker failures were rerun separately against the old source, not inferred from the diff. All nine cases pass on the new source. The 1.1-second cases settle exactly 1,100 ms, and continuous input settles 31,100 ms, without charging replay or fan-out again. `workerd.json` holds the result rows. Full `pnpm gate` passed: 949 unit tests, typechecks, lint, coverage, and the nine workerd cases. Its release-readiness report still lists four unrelated P0 store/billing items.

## Direct pacing comparison

Two short-clip repetitions interleaved full input at 1×, full at 4×, trailing-silence-trimmed at 1×, and trimmed at 4×. Each connection used the same model/configuration and an eight-second caption window. Two additional direct connections used the complete 20-second continuous-speech fixture, once at each pace.

| Input | Pace | Captions / connections |
| --- | --- | --- |
| Full 1.857-second robot clip | 1× | 1 / 2 |
| Full robot clip | 4× | 2 / 2 |
| Trimmed 0.9-second robot clip | 1× | 2 / 2 |
| Trimmed robot clip | 4× | 2 / 2 |
| Complete 20-second speech | 1× | 1 / 1 |
| Complete 20-second speech | 4× | 1 / 1 |

These small groups do not establish independent failure probabilities or explain the earlier 3/7 replay success rate. They do not implicate fast replay or trailing silence, so neither pacing nor input content changed. `direct.json` preserves timings and byte counts without transcript/audio content. The direct calls consumed 51.026 input-audio seconds.

## Live proof

`summary.json` contains the final full-input 10-short/10-long sandbox cohort, all 21 attempts, safe counters, source digests, costs, and restoration receipt. The two clips alternate. Every session observes first nonempty captions within 25 seconds of input start and keeps observing until that window ends. First-caption median uses the midpoint; p95 is nearest rank over caption successes, so ten successes make p95 equal max. Audio-to-caption offsets remain signed. Timing includes network and provider delay, not just model compute.

Every paid trial was retained across telemetry-harness restarts, not silently rerun. A non-OpenAI comparison showed that PostHog cached empty reads when refresh was supplied in the URL. Supplying `refresh: force_blocking` in the request body returned the ended event. An earlier unconfigured short preflight remains outside the 20-session cohort but inside the spend estimate. Each interrupted lifecycle restored the exact sandbox version and full observability settings before another deployment.

Two anomalies stay visible. Short trial four received captions before an abnormal client close at 18.650 seconds (code 1006); its ended event is absent. Its zero-retry count is inferred from original captions at 1.221 seconds, before the watchdog could fire, and the cost reserve includes all three possible input copies. Long trial five sent the full clip but acknowledged only 240,000 bytes (five seconds). Its ended event reports `client_close_session`, no failure code, and 26.842 seconds elapsed. The five-second billing checkpoint is a possible backpressure boundary, not a proven cause. Additional long trial 11 completed all 20 seconds and supplied the tenth full-input long trial. Its setup-only predecessor returned `503 provider_unconfigured` before any OpenAI connection; the next deployment passed a bounded readiness check before traffic. All attempts remain in the evidence.

Only numeric and boolean counters enter the ended event: retry attempts, whether recovery supplied selected captions, whether original captions arrived, connected/answered/failed side connections, and actual side-input byte count. A side connection canceled because original captions won is censored, not a deadline failure. Per-connection failure measurements must distinguish these outcomes.

### Final measurements

| Full-input clip | No caption within 25 s | First-caption median | p95 / max | Retry attempts |
| --- | --- | --- | --- | --- |
| Short, 10 sessions | 0/10 | 1.1855 s | 12.360 / 12.360 s | Eight zero, two one, none two. |
| Long, 10 sessions | 0/10 | 2.7695 s | 6.869 / 6.869 s | All ten zero. |

The original planned ten long attempts also had zero caption misses, median 2.5955 s and p95/max 3.690 s, but included the five-second delivery anomaly. Across all eleven long attempts, the median was 2.740 s and p95/max 6.869 s. All attempts had no client session-error events; the short-four abnormal transport close remains distinct from that statement.

Original connections without captions: 2/10 short, 0/10 full-input long, or 2/20 overall (10%). Caption-only connections: 2 answered out of 2, zero deadline/transport failures, zero censored connections. Retry histogram overall: 18 zero, 2 one, 0 two; one zero is explicitly inferred rather than observed in ended telemetry. The separate incomplete long attempt had original captions and zero retries.

No repeated caption landmark or duplicate voiced PCM frame was observed in the live captures. All nine workerd marker cases prove exact-once playback independently of translation lengths and mute. Free local ASR found no repeated long passage, but both recovered short original streams were near-silent (RMS 2.4–2.5), so it cannot prove audible content fidelity there. Recovery intentionally does not supply replacement audio.

Extra OpenAI estimate: $0.158758 from observed/inferred input duration, or **$0.160862** including two extra possible input copies for the missing-telemetry trial. Both include all direct probes, the unconfigured-analytics preflight, and every live attempt. Setup failures opened no OpenAI socket. No invoice was available. Independent read-back at 2026-10-17T17:56:12Z confirmed the original sandbox version/full observability exactly and disposable D1 HTTP 404.

## Privacy and limits

The workerd proof scans **complete captured PostHog payloads**, including every new retry field, for caption/audio sentinels: zero matches. The redesign adds no production log producer. Its fixed-message Sentry warning retains the existing sanitizer path, and classified log-outcome fields do not change. Astra's supplied round-two privacy audit passed these boundaries.

The earlier retained-Cloudflare privacy script did **not** pass: queries returned HTTP 200 and zero sentinel matches, but its required current-run synthetic-error control was absent. This round does not turn that incomplete control coverage into a passing retained-log proof. No production privacy traffic was sent.

Synthetic fixtures and exact marker tests do not establish translation accuracy, audio/text agreement between independent model streams, behavior in every language, or an upper bound on healthy caption latency. Free local ASR of captured playback is supporting evidence, not a perceptual or semantic oracle. Estimated OpenAI cost uses actual original plus side input duration at $0.034/minute; no invoice is available. A per-trial worst-case reservation prevents the next session from exceeding the round's $0.30 cap.
