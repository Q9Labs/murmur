import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as base64Decode } from 'base-64';

// Recording options for PCM audio suitable for Deepgram streaming
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 128000,
  },
};

// Chunk duration in ms - shorter = more responsive but more overhead
const CHUNK_DURATION_MS = 250;
const PROCESSING_WAIT_MS = 50;

const wait = (durationMs: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, durationMs));

export function useAudioRecording() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const onAudioDataRef = useRef<((data: ArrayBuffer) => void) | null>(null);
  const isStreamingRef = useRef(false);
  const isProcessingRef = useRef(false); // Mutex to prevent race conditions
  const isMountedRef = useRef(true);

  // Check permissions on mount
  useEffect(() => {
    const checkPermission = async () => {
      const { granted } = await Audio.getPermissionsAsync();
      if (isMountedRef.current) {
        setHasPermission(granted);
      }
    };
    checkPermission();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (isMountedRef.current) {
      setHasPermission(granted);
    }
    return granted;
  }, []);

  // Function to read and send audio chunk - runs in a loop
  const streamAudioLoop = useCallback(async () => {
    while (isStreamingRef.current) {
      await wait(CHUNK_DURATION_MS);
      if (!isStreamingRef.current) break;

      if (isProcessingRef.current) {
        await wait(PROCESSING_WAIT_MS);
        continue;
      }

      isProcessingRef.current = true;

      try {
        if (!recordingRef.current || !onAudioDataRef.current || !isStreamingRef.current) {
          isProcessingRef.current = false;
          break;
        }

        // Stop current recording to get the file
        const currentRecording = recordingRef.current;
        recordingRef.current = null;

        await currentRecording.stopAndUnloadAsync();
        const uri = currentRecording.getURI();

        // Start a new recording immediately if still streaming
        if (isStreamingRef.current) {
          const newRecording = new Audio.Recording();
          await newRecording.prepareToRecordAsync(RECORDING_OPTIONS);
          await newRecording.startAsync();
          recordingRef.current = newRecording;
        }

        // Process the previous recording's audio
        if (uri && onAudioDataRef.current) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Convert base64 to ArrayBuffer using polyfill (atob is not available in React Native)
          const binaryString = base64Decode(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Skip WAV header (44 bytes) to get raw PCM data
          const pcmData = bytes.slice(44);

          // Send to callback
          if (pcmData.length > 0 && onAudioDataRef.current) {
            onAudioDataRef.current(pcmData.buffer);
          }

          // Delete the temp file
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      } catch (err) {
        console.error('Error in audio stream loop:', err);
      }

      isProcessingRef.current = false;
    }
  }, []);

  const cleanupRecording = useCallback(
    async (updateState: boolean): Promise<void> => {
      try {
        isStreamingRef.current = false;

        // Wait for any in-progress chunk processing to release the recorder.
        while (isProcessingRef.current) {
          await wait(PROCESSING_WAIT_MS);
        }

        if (recordingRef.current) {
          const recording = recordingRef.current;
          recordingRef.current = null;

          try {
            await recording.stopAndUnloadAsync();
          } catch {
            // Ignore errors if already stopped or unloaded.
          }
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });

        onAudioDataRef.current = null;
        isProcessingRef.current = false;

        if (updateState && isMountedRef.current) {
          setIsRecording(false);
        }

        console.log('Recording stopped');
      } catch (err) {
        console.error('Failed to stop recording', err);
      }
    },
    [],
  );

  const startRecording = useCallback(async (onAudioData: (data: ArrayBuffer) => void) => {
    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          throw new Error('Microphone permission denied');
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      onAudioDataRef.current = onAudioData;
      isStreamingRef.current = true;
      isProcessingRef.current = false;

      // Start initial recording
      recordingRef.current = new Audio.Recording();
      await recordingRef.current.prepareToRecordAsync(RECORDING_OPTIONS);
      await recordingRef.current.startAsync();

      if (isMountedRef.current) {
        setIsRecording(true);
      }
      console.log('Recording started - streaming audio chunks');

      // Start the streaming loop (runs in background)
      streamAudioLoop();
    } catch (err) {
      console.error('Failed to start recording', err);
      isStreamingRef.current = false;
      await cleanupRecording(true);
      throw err;
    }
  }, [cleanupRecording, hasPermission, requestPermission, streamAudioLoop]);

  const stopRecording = useCallback(async () => {
    await cleanupRecording(true);
  }, [cleanupRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      void cleanupRecording(false);
    };
  }, [cleanupRecording]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    hasPermission,
    requestPermission,
  };
}
