import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Onboarding from '@/app/index';
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

describe('Onboarding Screen', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('renders the app title', () => {
    const { getByText } = render(<Onboarding />);
    expect(getByText('Murmur')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<Onboarding />);
    expect(getByText('Real-time translation powered by AI')).toBeTruthy();
  });

  it('displays the microphone icon', () => {
    const { getByText } = render(<Onboarding />);
    expect(getByText('🎙️')).toBeTruthy();
  });

  it('renders all three feature items', () => {
    const { getByText } = render(<Onboarding />);

    expect(getByText('Speak in any language')).toBeTruthy();
    expect(getByText('Instant AI translation')).toBeTruthy();
    expect(getByText('Beautiful, simple interface')).toBeTruthy();
  });

  it('displays feature icons', () => {
    const { getByText } = render(<Onboarding />);

    expect(getByText('🌍')).toBeTruthy();
    expect(getByText('⚡')).toBeTruthy();
    expect(getByText('✨')).toBeTruthy();
  });

  it('renders the Get Started button', () => {
    const { getByText } = render(<Onboarding />);
    expect(getByText('Get Started')).toBeTruthy();
  });

  it('navigates to language selection when Get Started is pressed', () => {
    const { getByText } = render(<Onboarding />);

    const getStartedButton = getByText('Get Started');
    fireEvent.press(getStartedButton);

    expect(mockPush).toHaveBeenCalledWith('/language-selection');
  });

  it('displays attribution text', () => {
    const { getByText } = render(<Onboarding />);
    expect(getByText('by Q9Labs')).toBeTruthy();
  });

  it('handles press in and press out events on button', () => {
    const { getByText } = render(<Onboarding />);

    const button = getByText('Get Started');

    // Should not throw errors
    fireEvent(button, 'pressIn');
    fireEvent(button, 'pressOut');

    expect(true).toBeTruthy();
  });
});
