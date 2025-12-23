import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import TranslateScreen from '@/app/translate';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Mock expo-router
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock useAudioRecording hook
jest.mock('@/hooks/useAudioRecording', () => ({
  useAudioRecording: jest.fn(() => ({
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    isRecording: false,
    hasPermission: true,
    requestPermission: jest.fn(() => Promise.resolve(true)),
  })),
}));

// Mock DeepgramService
jest.mock('@/services/deepgram', () => ({
  DeepgramService: jest.fn().mockImplementation(() => ({
    startStreaming: jest.fn(),
    sendAudio: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Mock TranslationService
jest.mock('@/services/translation', () => ({
  TranslationService: jest.fn().mockImplementation(() => ({
    translateStream: jest.fn(),
  })),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('TranslateScreen', () => {
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      languageCode: 'es',
      languageName: 'Spanish',
    });

    (useRouter as jest.Mock).mockReturnValue({
      back: mockBack,
    });

    // Clear environment variables for demo mode tests
    delete process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY;
    delete process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  });

  it('renders the header with target language', () => {
    const { getByText } = render(<TranslateScreen />);

    expect(getByText('Translating to')).toBeTruthy();
    expect(getByText('Spanish')).toBeTruthy();
  });

  it('displays placeholder texts initially', () => {
    const { getByText } = render(<TranslateScreen />);

    expect(getByText('Tap the microphone to start speaking...')).toBeTruthy();
    expect(getByText('Translation will appear here...')).toBeTruthy();
  });

  it('shows microphone button', () => {
    const { getByText } = render(<TranslateScreen />);

    expect(getByText('Tap to start speaking')).toBeTruthy();
    expect(getByText('🎙️')).toBeTruthy();
  });

  it('has back button that navigates back', () => {
    const { getByText } = render(<TranslateScreen />);

    const backButton = getByText('←');
    fireEvent.press(backButton);

    expect(mockBack).toHaveBeenCalled();
  });

  describe('Demo Mode', () => {
    it('shows demo alert when API keys are not configured', async () => {
      const { getByText } = render(<TranslateScreen />);

      const micButton = getByText('🎙️').parent;
      fireEvent.press(micButton!);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Demo Mode',
          expect.stringContaining('API keys are not configured'),
          expect.any(Array)
        );
      });
    });

    it('displays demo transcription in demo mode', async () => {
      const { getByText } = render(<TranslateScreen />);

      const micButton = getByText('🎙️').parent;
      fireEvent.press(micButton!);

      await waitFor(() => {
        expect(getByText('Hello, how are you today? This is a demo transcription.')).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  describe('Section Labels', () => {
    it('displays "Original" label for transcription', () => {
      const { getByText } = render(<TranslateScreen />);
      expect(getByText('Original')).toBeTruthy();
    });

    it('displays "Translation" label', () => {
      const { getByText } = render(<TranslateScreen />);
      expect(getByText('Translation')).toBeTruthy();
    });
  });

  describe('Language Display', () => {
    it('shows correct language from params', () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        languageCode: 'fr',
        languageName: 'French',
      });

      const { getByText } = render(<TranslateScreen />);
      expect(getByText('French')).toBeTruthy();
    });

    it('shows different language when params change', () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        languageCode: 'ja',
        languageName: 'Japanese',
      });

      const { getByText } = render(<TranslateScreen />);
      expect(getByText('Japanese')).toBeTruthy();
    });
  });
});
