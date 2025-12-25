# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Murmur is an AI-powered real-time translation app built with React Native (Expo). It captures speech via Deepgram's streaming speech-to-text API, automatically detects and translates it using Claude Haiku via OpenRouter, and displays both the transcription and translation in real-time with smooth animations.

**Key Architecture**: Flow is linear and event-driven:

1. User presses microphone button → triggers audio recording
2. Audio stream → sent to Deepgram WebSocket for real-time transcription
3. Transcription buffer → debounced (1000ms) before triggering translation
4. Translation request → OpenRouter API with streaming response
5. Both transcription and translation update UI reactively

## Development Commands

```bash
# Install dependencies (Bun recommended, but npm works)
bun install

# Start development server (Expo Tunnel for testing on devices)
bun start

# Run on specific platforms
bun ios          # iOS simulator
bun android      # Android emulator
bun web          # Web browser

# Linting and formatting
bunx prettier --write .          # Format code
bunx prettier --check .          # Check formatting
```

No test runner is currently configured. TypeScript checking via `expo` build process.

## Environment Setup

Create `.env` file (template in `.env.example`):

- `EXPO_PUBLIC_DEEPGRAM_API_KEY`: Get from https://console.deepgram.com/
- `EXPO_PUBLIC_OPENROUTER_API_KEY`: Get from https://openrouter.ai/keys

These are public environment variables (prefixed with `EXPO_PUBLIC_`) exposed to the client.

## Codebase Structure

### Routing (Expo Router)

- `app/_layout.tsx`: Root layout with font loading and splash screen setup. Stack navigation with three screens.
- `app/index.tsx`: Onboarding/welcome screen
- `app/language-selection.tsx`: Language picker (12 supported languages from `types/index.ts`)
- `app/translate.tsx`: Main translation screen with microphone input and real-time output

### Services (WebSocket-based, no heavy SDK dependencies)

**`services/deepgram.ts`**: DeepgramService class

- Uses native WebSocket (not the @deepgram/sdk to avoid Node.js dependencies)
- `startStreaming()`: Opens WebSocket with auth header, fires onTranscript callback for each transcription chunk
- `sendAudio()`: Sends raw PCM audio (16-bit, 16kHz) to WebSocket
- `stop()`: Closes WebSocket connection
- Model: `nova-2`, language: `multi` (auto-detect)

**`services/translation.ts`**: TranslationService class

- Uses OpenRouter API (not Vercel AI SDK directly) via native fetch
- `translateStream()`: Streams Claude Haiku responses with on-demand chunk parsing
- Parses Server-Sent Events (SSE) format: `data: {...JSON...}`
- Accumulates chunks in callback while parsing

### Hooks

**`hooks/useAudioRecording.ts`**: Audio capture hook

- Handles microphone permission (iOS/Android)
- Manages audio recording lifecycle
- Provides callback-based audio chunk delivery to services

### Types

**`types/index.ts`**:

- `Language` interface: code, name, nativeName, flag
- `SUPPORTED_LANGUAGES` array (12 languages): Spanish, French, German, Italian, Portuguese, Japanese, Chinese, Korean, Arabic, Russian, Hindi, Dutch
- `TranscriptSegment` and `TranslationSegment` interfaces (defined but not currently used in MVP)

### Styling

- **NativeWind** (Tailwind for React Native): All UI uses utility classes (`className` prop)
- `global.css`: Root stylesheet (imported in `_layout.tsx`)
- Font: Space Mono loaded in layout (see `_layout.tsx`)
- Color scheme: Pastel gradients (purples, pinks, blues in hex format)

## Key Implementation Details

### Real-Time Audio Streaming

- Audio is captured as PCM chunks and sent to Deepgram WebSocket as they arrive
- Deepgram returns JSON messages: `{channel: {alternatives: [{transcript: "..."}]}}`
- Transcription is buffered and appended to state

### Translation Debouncing

- Translation triggered via 1000ms debounce on transcription updates
- Uses `useRef` for timeout management to avoid redundant API calls
- Only translates when text is non-empty

### Demo Mode

- If API keys are missing, app enters DEMO_MODE (shows sample English/Spanish text)
- Useful for testing UI without API credentials

### Animation

- Uses React Native Reanimated for smooth microphone pulse/scale animations
- `LinearGradient` from `expo-linear-gradient` for pastel backgrounds
- `FadeIn`, `FadeInDown`, `useSharedValue`, `withSpring`, `withRepeat`, `withSequence` for transitions

### Error Handling

- API errors displayed in red error box on screen
- Microphone permission requests with fallback alert
- WebSocket/fetch errors logged to console and displayed to user

## TypeScript Configuration

- `tsconfig.json` extends `expo/tsconfig.base` with strict mode enabled
- Path alias: `@/*` maps to project root for clean imports
- Includes `.expo/types/`, `expo-env.d.ts`, and `nativewind-env.d.ts`

## Common Pitfalls to Avoid

1. **Audio Format**: Deepgram expects 16-bit PCM, 16kHz sample rate. The `useAudioRecording` hook should enforce this.
2. **WebSocket Headers**: Deepgram auth requires `Authorization: Token {apiKey}` header (not Bearer).
3. **SSE Parsing**: OpenRouter responses are Server-Sent Events (`data: {...}`), not plain JSON. Must split by `\n` and parse `data:` prefix.
4. **Permission Handling**: iOS and Android have different permission flows. Always request before starting recording.
5. **Cleanup**: Services (Deepgram WebSocket, translation timeouts) must be cleaned up on unmount or when stopping.
6. **Debouncing**: Translation requests are debounced to avoid overwhelming the API with intermediate transcription states.

## Styling Notes

- All components use NativeWind utility classes
- Gradients use `LinearGradient` component with hex color arrays
- Responsive breakpoints work on Expo (tablet-aware)
- Animations use Reanimated's shared values and animated components
- Backdrop blur (`backdrop-blur-sm`) works natively on React Native

## Future Considerations

- Text-to-speech (TTS) output for translated text (not in MVP)
- Additional language support beyond current 12
- Offline mode or local translation fallback
- User preferences/history storage
- Multi-language conversation support (not just one-way translation)
