# Murmur - Real-Time Translation Architecture

```mermaid
flowchart TB
    subgraph Step1["1. App Launch & Language Selection"]
        A1[User opens Murmur app]
        A2[Selects target translation language]
        A3[12 supported languages available]
        A1 --> A2 --> A3
    end

    subgraph Step2["2. Audio Capture"]
        B1[User taps microphone button]
        B2[Microphone permission requested]
        B3[Live audio captured from device mic]
        B4["PCM audio stream (16-bit, 16kHz)"]
        B1 --> B2 --> B3 --> B4
    end

    subgraph Step3["3. Real-Time Speech-to-Text"]
        C1[Audio chunks streamed via WebSocket]
        C2["Deepgram Nova-2 AI Engine"]
        C3[Multi-language auto-detection]
        C4[Live transcription returned]
        C1 --> C2 --> C3 --> C4
    end

    subgraph Step4["4. AI-Powered Translation"]
        D1["Transcription buffered (1s debounce)"]
        D2[Murmur backend translation request]
        D3["Claude Haiku LLM Translation"]
        D4[Streaming translation response]
        D1 --> D2 --> D3 --> D4
    end

    subgraph Step5["5. Real-Time Display"]
        E1[Original transcription displayed]
        E2[Translation displayed below]
        E3[Smooth animated updates]
        E4[Both update in real-time]
        E1 --> E3
        E2 --> E3
        E3 --> E4
    end

    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Step5

    %% Styling
    style Step1 fill:#e8f4f8,stroke:#4a9eba,stroke-width:2px
    style Step2 fill:#f0e8f8,stroke:#9a4aba,stroke-width:2px
    style Step3 fill:#e8f8e8,stroke:#4aba4a,stroke-width:2px
    style Step4 fill:#f8f0e8,stroke:#ba8a4a,stroke-width:2px
    style Step5 fill:#f8e8f0,stroke:#ba4a8a,stroke-width:2px
```

## Technical Flow Details

```mermaid
sequenceDiagram
    participant User
    participant App as Murmur App
    participant Mic as Device Microphone
    participant API as Murmur Backend
    participant DG as Deepgram API
    participant OR as OpenRouter API
    participant Claude as Claude Haiku

    User->>App: Select target language
    User->>App: Tap microphone button
    App->>Mic: Request permission
    Mic-->>App: Permission granted
    App->>API: Request scoped Deepgram auth token
    API-->>App: Short-lived token

    loop Real-time Audio Streaming
        Mic->>App: Audio chunk (PCM 16-bit)
        App->>DG: Stream audio via WebSocket
        DG-->>App: Transcription JSON
        App->>App: Update transcription display
    end

    App->>App: Debounce (1000ms)
    App->>API: Translation request (SSE)
    API->>OR: Provider request
    OR->>Claude: Process with Haiku

    loop Streaming Response
        Claude-->>OR: Translation chunk
        OR-->>API: Provider chunk
        API-->>App: SSE data chunk
        App->>App: Update translation display
    end
```

## System Architecture

```mermaid
graph LR
    subgraph Client["📱 React Native App (Expo)"]
        UI[UI Layer<br/>NativeWind + Reanimated]
        Hook[useAudioRecording Hook]
        DGService[DeepgramService]
        TRService[TranslationService]
    end

    subgraph External["☁️ External Services"]
        Backend["Murmur Backend<br/>Token + Translation"]
        Deepgram["🎤 Deepgram<br/>Nova-2 STT"]
        OpenRouter["🔀 OpenRouter<br/>API Gateway"]
        Claude["🤖 Claude Haiku<br/>Translation LLM"]
    end

    UI --> Hook
    Hook --> DGService
    DGService -->|short-lived token from backend| Backend
    DGService <-->|WebSocket| Deepgram
    UI --> TRService
    TRService <-->|SSE Stream| Backend
    Backend --> OpenRouter
    OpenRouter --> Claude

    style Client fill:#f5f5ff,stroke:#6366f1,stroke-width:2px
    style External fill:#fff5f5,stroke:#f43f5e,stroke-width:2px
```

## Supported Languages

| Flag | Language | Native Name |
|------|----------|-------------|
| 🇪🇸 | Spanish | Español |
| 🇫🇷 | French | Français |
| 🇩🇪 | German | Deutsch |
| 🇮🇹 | Italian | Italiano |
| 🇵🇹 | Portuguese | Português |
| 🇯🇵 | Japanese | 日本語 |
| 🇨🇳 | Chinese | 中文 |
| 🇰🇷 | Korean | 한국어 |
| 🇸🇦 | Arabic | العربية |
| 🇷🇺 | Russian | Русский |
| 🇮🇳 | Hindi | हिन्दी |
| 🇳🇱 | Dutch | Nederlands |
