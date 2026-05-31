import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type React from "react";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockRequestPermission = jest.fn();
const mockGetMurmurApiBaseUrl = jest.fn(() => "https://murmur.test");
const mockRequestDeepgramAuthToken = jest.fn();
const mockStartStreaming = jest.fn();
const mockSendAudio = jest.fn();
const mockStopDeepgram = jest.fn();
const mockIsAlive = jest.fn();
const mockGetAccumulatedTranscript = jest.fn();
const mockTranslateStream = jest.fn();
const mockUseSafeAreaInsets = jest.fn(() => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}));
const mockAlert = {
  alert: jest.fn(),
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({
    languageCode: "es",
    languageName: "Spanish",
  })),
  useRouter: jest.fn(() => ({
    back: mockBack,
    replace: mockReplace,
  })),
}));

jest.mock("@/services/backend", () => ({
  getMurmurApiBaseUrl: mockGetMurmurApiBaseUrl,
  requestDeepgramAuthToken: mockRequestDeepgramAuthToken,
}));

jest.mock("@/hooks/useAudioRecording", () => ({
  useAudioRecording: jest.fn(() => ({
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    isRecording: false,
    hasPermission: true,
    requestPermission: mockRequestPermission,
  })),
}));

jest.mock("@/services/deepgram", () => ({
  DeepgramService: jest.fn().mockImplementation(() => ({
    startStreaming: mockStartStreaming,
    sendAudio: mockSendAudio,
    stop: mockStopDeepgram,
    isAlive: mockIsAlive,
    getAccumulatedTranscript: mockGetAccumulatedTranscript,
  })),
}));

jest.mock("@/services/translation", () => ({
  TranslationService: jest.fn().mockImplementation(() => ({
    translateStream: mockTranslateStream,
  })),
}));

jest.mock("react-native", () => {
  const React = require("react");

  const createComponent = (name: string) =>
    React.forwardRef(
      (
        { children, ...props }: { children?: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => React.createElement(name, { ...props, ref }, children),
    );

  const Pressable = React.forwardRef(
    (
      {
        children,
        onPress,
        ...props
      }: { children?: React.ReactNode; onPress?: () => void },
      ref: React.Ref<unknown>,
    ) => React.createElement("Pressable", { ...props, ref, onPress }, children),
  );

  return {
    ActivityIndicator: createComponent("ActivityIndicator"),
    Alert: mockAlert,
    Dimensions: {
      get: jest.fn(() => ({ width: 390, height: 844 })),
    },
    Platform: {
      OS: "ios",
      select: (options: Record<string, unknown>) => options.ios ?? options.default,
    },
    Pressable,
    ScrollView: createComponent("ScrollView"),
    StyleSheet: {
      create: (styles: unknown) => styles,
      flatten: (style: unknown) => style,
    },
    Text: createComponent("Text"),
    View: createComponent("View"),
  };
});

jest.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => {
    const React = require("react");
    return React.createElement(React.Fragment, null, children);
  },
}));

jest.mock("@/components/ui", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    AnimatedMicButton: ({
      isListening,
      onPress,
    }: {
      isListening: boolean;
      onPress: () => void;
    }) =>
      React.createElement(
        Pressable,
        { testID: "mic-button", onPress },
        React.createElement(Text, null, isListening ? "listening" : "idle"),
      ),
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    IconButton: ({
      icon,
      onPress,
    }: {
      icon: string;
      onPress: () => void;
    }) =>
      React.createElement(
        Pressable,
        { testID: `icon-${icon}`, onPress },
        React.createElement(Text, null, icon),
      ),
  };
});

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    Feather: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock("react-native-reanimated", () => {
  const React = require("react");

  const AnimatedView = React.forwardRef(
    (
      { children, ...props }: { children?: React.ReactNode },
      ref: React.Ref<unknown>,
    ) => React.createElement("AnimatedView", { ...props, ref }, children),
  );
  const animationBuilder = {
    delay: () => animationBuilder,
    duration: () => animationBuilder,
  };

  return {
    __esModule: true,
    default: {
      View: AnimatedView,
    },
    Easing: {
      ease: jest.fn(),
      inOut: jest.fn((value) => value),
    },
    FadeIn: animationBuilder,
    FadeInDown: animationBuilder,
    useAnimatedStyle: jest.fn((factory) => factory()),
    useSharedValue: jest.fn((value) => ({ value })),
    withRepeat: jest.fn((value) => value),
    withSequence: jest.fn((...values) => values[values.length - 1]),
    withTiming: jest.fn((value) => value),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: mockUseSafeAreaInsets,
}));

const TranslateScreen =
  require("@/app/translate").default as typeof import("@/app/translate").default;

describe("TranslateScreen lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRequestDeepgramAuthToken.mockResolvedValue("deepgram-token");
    mockStartStreaming.mockResolvedValue({} as WebSocket);
    mockStartRecording.mockResolvedValue(undefined);
    mockStopRecording.mockResolvedValue(undefined);
    mockRequestPermission.mockResolvedValue(true);
    mockIsAlive.mockReturnValue(true);
    mockGetAccumulatedTranscript.mockReturnValue("");
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("starts live listening through the backend token path", async () => {
    const { getByTestId } = render(<TranslateScreen />);

    await act(async () => {
      fireEvent.press(getByTestId("mic-button"));
    });

    await waitFor(() => {
      expect(mockRequestDeepgramAuthToken).toHaveBeenCalledWith(
        "https://murmur.test",
      );
      expect(mockStartStreaming).toHaveBeenCalledTimes(1);
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });
  });

  it("cleans the current recorder and connection before starting a retry", async () => {
    let resolveStopRecording: () => void = () => {};
    mockStopRecording.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStopRecording = resolve;
        }),
    );

    const { getByTestId } = render(<TranslateScreen />);

    await act(async () => {
      fireEvent.press(getByTestId("mic-button"));
    });

    await waitFor(() => {
      expect(mockStartStreaming).toHaveBeenCalledTimes(1);
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });

    const callbacks = mockStartStreaming.mock.calls[0][0];
    act(() => {
      callbacks.onError(new Error("socket failed"));
    });

    expect(mockStopDeepgram).toHaveBeenCalledTimes(1);
    expect(mockStopRecording).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockStartStreaming).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStopRecording();
    });

    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockStartStreaming).toHaveBeenCalledTimes(2);
      expect(mockStartRecording).toHaveBeenCalledTimes(2);
    });

    expect(
      mockStopRecording.mock.invocationCallOrder[0],
    ).toBeLessThan(mockStartStreaming.mock.invocationCallOrder[1]);
  });
});
