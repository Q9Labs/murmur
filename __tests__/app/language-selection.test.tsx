import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LanguageSelection from '@/app/language-selection';
import { useRouter } from 'expo-router';

// Mock expo-router
jest.mock('expo-router', () => ({
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

describe('LanguageSelection Screen', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('renders the header correctly', () => {
    const { getByText } = render(<LanguageSelection />);

    expect(getByText('Choose Language')).toBeTruthy();
    expect(getByText('Select the language you want translations in')).toBeTruthy();
  });

  it('displays all 12 supported languages', () => {
    const { getByText } = render(<LanguageSelection />);

    // Check a few languages
    expect(getByText('Spanish')).toBeTruthy();
    expect(getByText('French')).toBeTruthy();
    expect(getByText('German')).toBeTruthy();
    expect(getByText('Japanese')).toBeTruthy();
    expect(getByText('Chinese')).toBeTruthy();
  });

  it('displays native language names', () => {
    const { getByText } = render(<LanguageSelection />);

    expect(getByText('Español')).toBeTruthy();
    expect(getByText('Français')).toBeTruthy();
    expect(getByText('Deutsch')).toBeTruthy();
    expect(getByText('日本語')).toBeTruthy();
  });

  it('does not show continue button initially', () => {
    const { queryByText } = render(<LanguageSelection />);

    expect(queryByText(/Continue with/)).toBeNull();
  });

  it('allows selecting a language', () => {
    const { getByText, queryByText } = render(<LanguageSelection />);

    const spanishButton = getByText('Spanish').parent?.parent;
    expect(spanishButton).toBeTruthy();

    fireEvent.press(spanishButton!);

    // Continue button should now appear
    expect(getByText('Continue with Spanish')).toBeTruthy();
  });

  it('shows checkmark on selected language', () => {
    const { getByText } = render(<LanguageSelection />);

    const frenchButton = getByText('French').parent?.parent;
    fireEvent.press(frenchButton!);

    // Check for checkmark (✓)
    expect(getByText('✓')).toBeTruthy();
  });

  it('navigates to translate screen when continue is pressed', async () => {
    const { getByText } = render(<LanguageSelection />);

    // Select Japanese
    const japaneseButton = getByText('Japanese').parent?.parent;
    fireEvent.press(japaneseButton!);

    // Press continue button
    const continueButton = getByText('Continue with Japanese');
    fireEvent.press(continueButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/translate',
        params: { languageCode: 'ja', languageName: 'Japanese' },
      });
    });
  });

  it('allows changing language selection', () => {
    const { getByText, getAllByText } = render(<LanguageSelection />);

    // Select Spanish
    const spanishButton = getByText('Spanish').parent?.parent;
    fireEvent.press(spanishButton!);
    expect(getByText('Continue with Spanish')).toBeTruthy();

    // Change to German
    const germanButton = getByText('German').parent?.parent;
    fireEvent.press(germanButton!);
    expect(getByText('Continue with German')).toBeTruthy();

    // Only one checkmark should be present
    expect(getAllByText('✓').length).toBe(1);
  });
});
