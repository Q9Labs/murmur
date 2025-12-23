import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import type { RecordingOptions, AudioRecorder } from 'expo-audio';

// Custom recording preset for PCM audio suitable for Deepgram streaming
const DEEPGRAM_RECORDING_OPTIONS: RecordingOptions = {
  isMeteringEnabled: true,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    extension: '.wav',
    outputFormat: 'default',
    audioEncoder: 'default',
    sampleRate: 16000,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 128000,
  },
};

export function useAudioRecording() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const recorder = useAudioRecorder(DEEPGRAM_RECORDING_OPTIONS, (status) => {
    if (status.isFinished) {
      setIsRecording(false);
    }
  });

  // Check permissions on mount
  useEffect(() => {
    const checkPermission = async () => {
      const { granted } = await getRecordingPermissionsAsync();
      setHasPermission(granted);
    };
    checkPermission();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { granted } = await requestRecordingPermissionsAsync();
    setHasPermission(granted);
    return granted;
  }, []);

  const startRecording = useCallback(async (onAudioData: (data: ArrayBuffer) => void) => {
    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          throw new Error('Microphone permission denied');
        }
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);

      // Note: React Native doesn't provide direct chunk access like Web API
      // The onAudioData callback is provided for API compatibility, but real-time
      // streaming requires a native module. For now, recording saves to a file
      // which can be read after stopping.
    } catch (err) {
      console.error('Failed to start recording', err);
      throw err;
    }
  }, [hasPermission, requestPermission, recorder]);

  const stopRecording = useCallback(async () => {
    try {
      await recorder.stop();

      await setAudioModeAsync({
        allowsRecording: false,
      });

      setIsRecording(false);

      // Return the URI of the recorded file
      return recorder.uri;
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }, [recorder]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    hasPermission,
    requestPermission,
    recordingUri: recorder.uri,
  };
}
