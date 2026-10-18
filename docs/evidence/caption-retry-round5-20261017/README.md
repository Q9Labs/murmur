# Continuous caption recovery

Round five supersedes round four’s permanent first-caption winner. The original OpenAI socket remains the only playback source. Recovery now monitors the whole session: while original output audio keeps arriving, ten seconds without a meaningful caption stalls the current caption source. A ten-second break in output starts a new observation window; normal silence does not consume attempts. Startup still has a timed deadline after first audio, even when a short clip ends without any caption. A side close, provider error, or invalid message stalls it immediately. Queued original captions take precedence at fallback; otherwise another caption-only attempt opens. A side’s initial response deadline remains connect plus buffered replay time at four times speed plus five seconds.

The session has at most two caption-only attempts, never reset by success. All side connections together receive at most 120 seconds of input audio. At the published $0.034/minute rate this bounds extra model input cost to $0.068, even if a winning side stays open for a long session. At either cap, original playback and any original captions continue. Only real input is billed to the user.

A handoff retains original captions that arrived while the side was selected. It suppresses an exact prefix that matches the end of text already delivered, across different delta boundaries. This also handles a replay starting in a rolling input buffer. It does not fuzzy-match wording or erase a phrase merely because some leading letters match. Independent translations have no common text offsets: semantic equivalence and a genuinely repeated utterance cannot be distinguished from text alone. This proof establishes exact textual-prefix behavior, not a semantic deduplication guarantee for arbitrary paraphrases.

Only non-whitespace text selects a source. After selection, every active-source space and newline is preserved. Provider event metadata also survives the original-caption routing path. A side sets captions_recovered only when it supplies new visible non-whitespace text, not when it only repeats a prefix already shown.

## Failing-before proof

The real proxy runs in workerd with fake OpenAI and PostHog plus real D1 settlement. All eight new cases fail on 59673c3: winner close 1011, provider error, silent winner with original fallback, silent winner requiring a second side, original captions stalling later, lifetime cap after winners, original whitespace, and side whitespace. Whitespace reproduces hello/world/next with its separate space and newline removed. The new implementation passes these cases alongside all nine earlier audio-routing, long-input, billing and arbitration cases.

The exact marker ledger proves original audio remains ordered and delivered once. Complete captured telemetry payloads contain zero audio/transcript sentinels, including the existing safe retry counters. No production log producer or sanitizer changes were introduced. The earlier retained-Cloudflare synthetic-error control gap is unchanged; this round does not claim that script passed.

## Final verification

[summary.json](summary.json) records the final gate, live results, source hashes, spend, and independently verified exact sandbox restoration. Only synthetic short English speech is used, with Spanish captions, playback on and near-field reduction. Ten sessions retain a 25-second caption window; all attempts and transport anomalies remain visible. No production access or merge is permitted.

A preflight candidate armed ongoing expiry after speech stopped. A local regression reproduced two unnecessary retries in quiet healthy speech. The final ongoing check runs on arriving audio instead; a new utterance after a long pause gets a full observation window. One live preflight on that earlier candidate received captions at1.660s then closed1006 at16.700s; ended telemetry was missing. Its cause is not proven. It remains outside the final-head ten-session cohort and inside a conservative three-input-copy spend reserve. The harness restored exactly before the rule correction.

## Round-five result

All ten final-head short-clip sessions received captions within 25 seconds. Retry counts were seven at zero, two at one, and one at two. First-caption median was 1.1955s; nearest-rank p95 and maximum were 17.740s. Original connections missed captions in 3/10 sessions; caption-only connections missed in 1/4 attempts. All ten client sessions closed cleanly and retained every caption delta unchanged, including spaces. No standalone whitespace-only delta occurred live; both exact whitespace-only fixtures pass in workerd.

The full Mac mini gate passed 956 unit tests and 18 workerd scenarios. All eight new regression scenarios fail on59673c3. Estimated extra OpenAI spend is $0.017885, including the conservative three-copy preflight reserve, below the $0.10 cap. This is a duration-based estimate, not an invoice. The sandbox version and full observability object match their original values; both temporary databases return404.
