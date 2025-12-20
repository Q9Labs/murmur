import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { PermissionStatus } from 'expo-modules-core';

export function useAudioRecording() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isRecording, setIsRecording] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async (onAudioData: (data: ArrayBuffer) => void) => {
    try {
      if (permissionResponse?.status !== PermissionStatus.GRANTED) {
        const permission = await requestPermission();
        if (permission.status !== PermissionStatus.GRANTED) {
          throw new Error('Microphone permission denied');
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        {
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
        },
        // Status update callback for streaming
        async (status) => {
          if (status.isRecording && status.metering !== undefined) {
            // Stream audio chunks
            // Note: For production, you'd need a proper audio streaming mechanism
            // This is a simplified version
          }
        },
        100 // Update interval in milliseconds
      );

      recordingRef.current = recording;
      setRecording(recording);
      setIsRecording(true);

      // Start monitoring for audio data
      // Note: React Native doesn't provide direct chunk access like Web API
      // In production, you'd use a native module or different approach

    } catch (err) {
      console.error('Failed to start recording', err);
      throw err;
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      setRecording(null);
      recordingRef.current = null;
      setIsRecording(false);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    isRecording,
    hasPermission: permissionResponse?.status === PermissionStatus.GRANTED,
    requestPermission,
  };
}
