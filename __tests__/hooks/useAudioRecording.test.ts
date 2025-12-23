import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import * as ExpoAudio from 'expo-audio';

// Mock expo-audio
jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(),
  requestRecordingPermissionsAsync: jest.fn(),
  getRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
  IOSOutputFormat: {
    LINEARPCM: 'lpcm',
  },
  AudioQuality: {
    HIGH: 96,
  },
}));

describe('useAudioRecording Hook', () => {
  const mockRecorder = {
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (ExpoAudio.useAudioRecorder as jest.Mock).mockReturnValue(mockRecorder);
    (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
    });
    (ExpoAudio.requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ExpoAudio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useAudioRecording());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.hasPermission).toBe(false);
    expect(typeof result.current.startRecording).toBe('function');
    expect(typeof result.current.stopRecording).toBe('function');
    expect(typeof result.current.requestPermission).toBe('function');
  });

  it('checks permission on mount', async () => {
    renderHook(() => useAudioRecording());

    await waitFor(() => {
      expect(ExpoAudio.getRecordingPermissionsAsync).toHaveBeenCalled();
    });
  });

  it('updates hasPermission when granted', async () => {
    (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });

    const { result } = renderHook(() => useAudioRecording());

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
    });
  });

  describe('requestPermission', () => {
    it('requests permission and updates state', async () => {
      const { result } = renderHook(() => useAudioRecording());

      let permissionGranted: boolean = false;
      await act(async () => {
        permissionGranted = await result.current.requestPermission();
      });

      expect(ExpoAudio.requestRecordingPermissionsAsync).toHaveBeenCalled();
      expect(permissionGranted).toBe(true);
      expect(result.current.hasPermission).toBe(true);
    });

    it('returns false when permission denied', async () => {
      (ExpoAudio.requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      });

      const { result } = renderHook(() => useAudioRecording());

      let permissionGranted: boolean = true;
      await act(async () => {
        permissionGranted = await result.current.requestPermission();
      });

      expect(permissionGranted).toBe(false);
      expect(result.current.hasPermission).toBe(false);
    });
  });

  describe('startRecording', () => {
    it('requests permission if not granted', async () => {
      const { result } = renderHook(() => useAudioRecording());

      const onAudioData = jest.fn();

      await act(async () => {
        await result.current.startRecording(onAudioData);
      });

      expect(ExpoAudio.requestRecordingPermissionsAsync).toHaveBeenCalled();
    });

    it('sets audio mode for recording', async () => {
      (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      });

      const { result } = renderHook(() => useAudioRecording());

      const onAudioData = jest.fn();

      await act(async () => {
        await result.current.startRecording(onAudioData);
      });

      expect(ExpoAudio.setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    });

    it('prepares recorder and starts recording', async () => {
      (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      });

      const { result } = renderHook(() => useAudioRecording());

      const onAudioData = jest.fn();

      await act(async () => {
        await result.current.startRecording(onAudioData);
      });

      expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalled();
      expect(mockRecorder.record).toHaveBeenCalled();
    });

    it('updates isRecording state', async () => {
      (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      });

      const { result } = renderHook(() => useAudioRecording());

      const onAudioData = jest.fn();

      await act(async () => {
        await result.current.startRecording(onAudioData);
      });

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });
    });

    it('throws error when permission denied', async () => {
      (ExpoAudio.requestRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      });

      const { result } = renderHook(() => useAudioRecording());

      const onAudioData = jest.fn();

      await expect(
        act(async () => {
          await result.current.startRecording(onAudioData);
        })
      ).rejects.toThrow('Microphone permission denied');
    });
  });

  describe('stopRecording', () => {
    it('stops the recorder', async () => {
      (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      });

      const { result } = renderHook(() => useAudioRecording());

      // Start recording first
      await act(async () => {
        await result.current.startRecording(jest.fn());
      });

      // Stop recording
      await act(async () => {
        await result.current.stopRecording();
      });

      expect(mockRecorder.stop).toHaveBeenCalled();
    });

    it('resets audio mode', async () => {
      (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      });

      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.startRecording(jest.fn());
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      expect(ExpoAudio.setAudioModeAsync).toHaveBeenCalledWith({
        allowsRecording: false,
      });
    });

    it('updates isRecording to false', async () => {
      (ExpoAudio.getRecordingPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      });

      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.startRecording(jest.fn());
      });

      await act(async () => {
        await result.current.stopRecording();
      });

      await waitFor(() => {
        expect(result.current.isRecording).toBe(false);
      });
    });
  });

  describe('Recording Options', () => {
    it('uses correct audio settings for Deepgram', () => {
      renderHook(() => useAudioRecording());

      const recorderCall = (ExpoAudio.useAudioRecorder as jest.Mock).mock.calls[0];
      const recordingOptions = recorderCall[0];

      expect(recordingOptions.sampleRate).toBe(16000);
      expect(recordingOptions.numberOfChannels).toBe(1);
      expect(recordingOptions.extension).toBe('.wav');
      expect(recordingOptions.isMeteringEnabled).toBe(true);
    });
  });
});
