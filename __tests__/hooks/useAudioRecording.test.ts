import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";

type MockFn = ReturnType<typeof jest.fn>;

const mockRecordingInstances: Array<{
  prepareToRecordAsync: MockFn;
  startAsync: MockFn;
  stopAndUnloadAsync: MockFn;
  getURI: MockFn;
}> = [];

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSetAudioModeAsync = jest.fn();
const mockRecordingConstructor = jest.fn().mockImplementation(() => {
  const recording = {
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    startAsync: jest.fn().mockResolvedValue(undefined),
    stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
    getURI: jest.fn(() => null),
  };
  mockRecordingInstances.push(recording);
  return recording;
});

jest.mock("expo-av", () => ({
  Audio: {
    getPermissionsAsync: mockGetPermissionsAsync,
    requestPermissionsAsync: mockRequestPermissionsAsync,
    setAudioModeAsync: mockSetAudioModeAsync,
    Recording: mockRecordingConstructor,
    AndroidOutputFormat: {
      DEFAULT: "default",
    },
    AndroidAudioEncoder: {
      DEFAULT: "default",
    },
    IOSOutputFormat: {
      LINEARPCM: "lpcm",
    },
    IOSAudioQuality: {
      HIGH: "high",
    },
  },
}));

jest.mock("expo-file-system/legacy", () => ({
  EncodingType: {
    Base64: "base64",
  },
  readAsStringAsync: require("@jest/globals").jest.fn(),
  deleteAsync: require("@jest/globals").jest.fn(),
}));

const { useAudioRecording } = require("@/hooks/useAudioRecording") as typeof import("@/hooks/useAudioRecording");
const { Audio } = require("expo-av") as typeof import("expo-av");

describe("useAudioRecording", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRecordingInstances.length = 0;
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockSetAudioModeAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("checks permission on mount", async () => {
    renderHook(() => useAudioRecording());

    await waitFor(() => {
      expect(Audio.getPermissionsAsync).toHaveBeenCalled();
    });
  });

  it("requests permission and updates state", async () => {
    const { result } = renderHook(() => useAudioRecording());

    let permissionGranted = false;
    await act(async () => {
      permissionGranted = await result.current.requestPermission();
    });

    expect(Audio.requestPermissionsAsync).toHaveBeenCalled();
    expect(permissionGranted).toBe(true);
    expect(result.current.hasPermission).toBe(true);
  });

  it("sets recording audio mode and starts the native recorder", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    const { result } = renderHook(() => useAudioRecording());

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
    });

    await act(async () => {
      await result.current.startRecording(jest.fn());
    });

    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    expect(mockRecordingConstructor).toHaveBeenCalledTimes(1);
    expect(mockRecordingInstances[0].prepareToRecordAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        isMeteringEnabled: true,
        ios: expect.objectContaining({
          sampleRate: 16000,
          numberOfChannels: 1,
        }),
      }),
    );
    expect(mockRecordingInstances[0].startAsync).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      await result.current.stopRecording();
    });
  });

  it("stops, unloads, and clears audio mode", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    const { result } = renderHook(() => useAudioRecording());

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
    });

    await act(async () => {
      await result.current.startRecording(jest.fn());
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(mockRecordingInstances[0].stopAndUnloadAsync).toHaveBeenCalled();
    expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith({
      allowsRecordingIOS: false,
    });
    expect(result.current.isRecording).toBe(false);
  });

  it("unloads the native recorder and clears audio mode on unmount", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    const { result, unmount } = renderHook(() => useAudioRecording());

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
    });

    await act(async () => {
      await result.current.startRecording(jest.fn());
    });

    act(() => {
      unmount();
    });

    await waitFor(() => {
      expect(mockRecordingInstances[0].stopAndUnloadAsync).toHaveBeenCalled();
    });
    expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith({
      allowsRecordingIOS: false,
    });
  });

  it("throws when permission is denied", async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => useAudioRecording());

    await expect(
      act(async () => {
        await result.current.startRecording(jest.fn());
      }),
    ).rejects.toThrow("Microphone permission denied");
  });
});
