# Murmur Audio Translation Flow

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         translate.tsx (Main Screen)                          │
│                                                                               │
│  ┌───────────────┐    ┌──────────────┐    ┌────────────────┐               │
│  │ User presses  │───▶│ Toggle       │───▶│ Start/Stop     │               │
│  │ mic button    │    │ isListening  │    │ Services       │               │
│  └───────────────┘    └──────────────┘    └────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴────────────┐
                    ▼                        ▼
         ┌──────────────────┐    ┌──────────────────────┐
         │ Audio Recording  │    │ Transcription &      │
         │ Pipeline         │    │ Translation Pipeline │
         └──────────────────┘    └──────────────────────┘
```

## Detailed Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: AUDIO CAPTURE (useAudioRecording.ts)                               │
└─────────────────────────────────────────────────────────────────────────────┘

 ① User Press
    │
    ▼
 ② startRecording(onAudioData callback)
    │
    ├─▶ Request mic permission (if needed)
    ├─▶ Set audio mode (iOS/Android)
    ├─▶ Create Audio.Recording instance
    └─▶ Start streamAudioLoop() ◄───────────┐
         │                                   │
         │ [Runs continuously every 250ms]   │
         ▼                                   │
    ③ Loop Iteration:                        │
         │                                   │
         ├─▶ Stop current recording          │
         ├─▶ Get WAV file URI                │
         ├─▶ Start NEW recording immediately │──┘ (seamless chunks)
         ├─▶ Read previous file as base64    │
         ├─▶ Convert base64 → ArrayBuffer    │
         ├─▶ Skip 44-byte WAV header         │
         ├─▶ Extract raw PCM data            │
         ├─▶ Call onAudioData(pcmBuffer)     │
         ├─▶ Delete temp file                │
         └─▶ Wait 250ms, repeat              │
              │
              ▼
         [PCM chunks ready for streaming]


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: SPEECH-TO-TEXT (deepgram.ts)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

 ④ deepgramRef.startStreaming(onTranscript, onError)
    │
    ├─▶ Build WebSocket URL with params:
    │   • model: 'nova-2'
    │   • language: 'multi' (auto-detect)
    │   • encoding: 'linear16', sample_rate: '16000'
    │   • interim_results: 'true', punctuate: 'true'
    │
    └─▶ Open WebSocket: wss://api.deepgram.com/v1/listen?...
         │
         ├─▶ Auth via Sec-WebSocket-Protocol: ['token', apiKey]
         │
         └─▶ Event Handlers:
              │
              ├─ ws.onopen ──▶ Connection established ✓
              │
              ├─ ws.onmessage ──▶ ⑤ Parse JSON transcript
              │   │                   │
              │   │                   ├─▶ Extract: data.channel.alternatives[0].transcript
              │   │                   └─▶ Call onTranscript(text) if non-empty
              │   │
              ├─ ws.onerror ──▶ Call onError()
              │
              └─ ws.onclose ──▶ Check abnormal codes, call onError if needed

 ⑥ sendAudio(audioData: ArrayBuffer)
    │
    └─▶ ws.send(audioData) ◄─── Called by onAudioData callback
         │                       (every 250ms from audio loop)
         │
         ▼
    [Deepgram processes PCM stream in real-time]
         │
         ▼
    ⑦ Transcript chunks arrive via ws.onmessage


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: TRANSCRIPTION UPDATE & DEBOUNCING (translate.tsx)                  │
└─────────────────────────────────────────────────────────────────────────────┘

 ⑧ onTranscript callback in translate.tsx:131-148
    │
    ├─▶ setTranscription(prev => prev + ' ' + transcript)
    │    │
    │    └─▶ Update UI immediately (Original text box)
    │
    ├─▶ Update transcriptionBufferRef.current
    │
    └─▶ Debounce Translation:
         │
         ├─▶ Clear existing timeout
         │
         └─▶ setTimeout(() => handleTranslate(text), 1000)
              │
              │ [Wait 1000ms for transcription to stabilize]
              │
              ▼
         ⑨ Translation triggered only after 1s of silence


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: TRANSLATION (translation.ts)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

 ⑩ translationRef.translateStream(text, targetLang, onChunk, onComplete, onError)
    │
    └─▶ POST https://openrouter.ai/api/v1/chat/completions
         │
         ├─▶ Headers:
         │   • Authorization: Bearer {apiKey}
         │   • Content-Type: application/json
         │
         ├─▶ Body:
         │   • model: 'anthropic/claude-3.5-haiku'
         │   • messages: [{role: 'user', content: 'Translate...'}]
         │   • temperature: 0.3
         │   • stream: true
         │
         └─▶ ⑪ Response: Server-Sent Events (SSE) stream
              │
              ├─▶ Get ReadableStream reader
              │
              └─▶ Read loop:
                   │
                   ├─▶ Read chunk from stream
                   ├─▶ Decode as text
                   ├─▶ Split by '\n'
                   ├─▶ Filter lines starting with 'data: '
                   ├─▶ Parse JSON from 'data: {...}'
                   ├─▶ Extract: parsed.choices[0].delta.content
                   ├─▶ Accumulate: fullTranslation += content
                   ├─▶ Call onChunk(content) ◄───┐
                   │                              │
                   └─▶ Continue until done        │
                        │                         │
                        ▼                         │
                   ⑫ Call onComplete(fullTranslation)


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: UI UPDATE (translate.tsx)                                          │
└─────────────────────────────────────────────────────────────────────────────┘

 ⑬ onChunk callback in translate.tsx:178-180
    │
    ├─▶ Accumulate: currentTranslation += chunk
    │
    └─▶ setTranslation(currentTranslation)
         │
         └─▶ Update UI immediately (Translation text box)
              │
              │ [Smooth streaming effect as chunks arrive]
              │
              ▼
         Translation appears word-by-word in real-time


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: STOP FLOW                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

 User presses mic button again
    │
    ├─▶ deepgramRef.stop()
    │    └─▶ ws.close() ──▶ Close WebSocket connection
    │
    ├─▶ stopRecording()
    │    ├─▶ Set isStreamingRef.current = false
    │    ├─▶ Wait for processing to complete
    │    ├─▶ Stop and unload recording
    │    └─▶ Reset audio mode
    │
    └─▶ Reset animations (mic scale, pulse opacity)
```

## Key Technical Details

### Audio Format

- **Sample Rate**: 16kHz
- **Encoding**: 16-bit Linear PCM
- **Channels**: Mono (1)
- **Chunk Size**: 250ms intervals
- **Header**: Skip first 44 bytes (WAV header)

### WebSocket (Deepgram)

- **URL**: `wss://api.deepgram.com/v1/listen`
- **Auth**: Sec-WebSocket-Protocol header `['token', apiKey]`
- **Model**: nova-2
- **Language**: multi (auto-detect)
- **Interim Results**: Enabled

### HTTP Streaming (OpenRouter)

- **URL**: `https://openrouter.ai/api/v1/chat/completions`
- **Auth**: Bearer token
- **Model**: anthropic/claude-3.5-haiku
- **Format**: Server-Sent Events (SSE)
- **Parsing**: Split by `\n`, extract `data: ` prefix

### Timing

- **Audio Chunks**: Every 250ms
- **Translation Debounce**: 1000ms (1 second)
- **Deepgram**: Real-time (< 100ms latency)
- **OpenRouter**: Streaming (chunks arrive progressively)

### State Management

- **transcription**: React state (immediate UI update)
- **translation**: React state (streaming chunks)
- **transcriptionBufferRef**: useRef (debounce coordination)
- **translationTimeoutRef**: useRef (debounce timer)
- **Services**: useRef (persist across renders)

### UI Updates

- **Transcription**: Immediate append on each Deepgram message
- **Translation**: Incremental update as OpenRouter chunks arrive
- **Animations**: Reanimated shared values (mic pulse, scale)
- **Error**: Displayed in red alert box below translation

### Cleanup

- **WebSocket**: Closed on stop or unmount
- **Recording**: Unloaded and audio mode reset
- **Timeouts**: Cleared on component unmount
- **Temp Files**: Deleted immediately after processing

## Key Insights

1. **Audio chunks every 250ms** - Continuous seamless recording by stopping/starting recordings in a loop
2. **Real-time transcription** - Deepgram processes audio as it arrives via WebSocket
3. **1-second debounce** - Prevents excessive translation API calls while user is still speaking
4. **Streaming translation** - Text appears word-by-word for smooth UX
5. **State coordination** - useRef for services/timers, useState for UI updates
6. **No heavy SDKs** - Native WebSocket and fetch for minimal dependencies
7. **PCM extraction** - Skip WAV header (44 bytes) before sending to Deepgram
8. **SSE parsing** - Manual parsing of Server-Sent Events from OpenRouter
