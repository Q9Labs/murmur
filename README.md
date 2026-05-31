# Murmur by Q9Labs

AI-Powered Real-Time Translation App

## Features

- 🎙️ Real-time speech-to-text with Deepgram
- 🌍 Multilingual auto-detection
- ⚡ Instant AI translation with Claude Haiku 3.5
- ✨ Beautiful, minimal UI with smooth animations
- 🎨 Modern pastel design with NativeWind

## Tech Stack

- **Framework**: Expo (React Native)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Animations**: React Native Reanimated
- **Speech-to-Text**: Deepgram SDK
- **Translation**: Murmur backend with OpenRouter (Claude Haiku 3.5)
- **Package Manager**: Bun

## Setup

1. **Install dependencies:**

   ```bash
   bun install
   # or
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Set `EXPO_PUBLIC_MURMUR_API_BASE_URL` to the Murmur backend URL
   - Keep Deepgram and OpenRouter provider keys on the backend only

3. **Run the app:**
   ```bash
   bun start
   # or
   npm start
   ```

## User Flow

1. **Onboarding**: Brief welcome screen
2. **Language Selection**: Choose target translation language (10+ languages)
3. **Translation**: Tap microphone, speak, see live transcription and translation

## Supported Languages

- Spanish (Español)
- French (Français)
- German (Deutsch)
- Italian (Italiano)
- Portuguese (Português)
- Japanese (日本語)
- Chinese (中文)
- Korean (한국어)
- Arabic (العربية)
- Russian (Русский)
- Hindi (हिन्दी)
- Dutch (Nederlands)

## Development

- **iOS**: `bun ios` or `npm run ios`
- **Android**: `bun android` or `npm run android`
- **Web**: `bun web` or `npm run web`

## Notes

- Microphone permission required for audio capture
- A Murmur backend is required for live translation; production clients must not embed provider API keys
- Expected backend endpoints: `POST /deepgram/token` returns `{ "token": "..." }`; `POST /translate` accepts `{ text, targetLanguage, stream }` and returns SSE chunks or a non-stream `{ "translation": "..." }`
- This is a one-way translation tool (no TTS output in MVP)

## Architecture

```
app/
├── index.tsx                 # Onboarding screen
├── language-selection.tsx    # Language picker
├── translate.tsx             # Main translation screen
└── _layout.tsx              # Root navigation

services/
├── deepgram.ts              # Deepgram streaming STT
├── backend.ts               # Public backend URL and token plumbing
└── translation.ts           # Backend-routed AI translation

hooks/
└── useAudioRecording.ts     # Audio recording hook

types/
└── index.ts                 # Type definitions
```

---

Built with ❤️ by Q9Labs
