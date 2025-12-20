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
- **Translation**: Vercel AI SDK with OpenRouter (Claude Haiku 3.5)
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
   - Add your Deepgram API key from [console.deepgram.com](https://console.deepgram.com/)
   - Add your OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys)

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
- API keys required for Deepgram and OpenRouter
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
└── translation.ts           # AI SDK translation with OpenRouter

hooks/
└── useAudioRecording.ts     # Audio recording hook

types/
└── index.ts                 # Type definitions
```

---

Built with ❤️ by Q9Labs
