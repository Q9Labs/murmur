import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { DeepgramService } from '@/services/deepgram';
import { TranslationService } from '@/services/translation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// API Keys - In production, these should be in environment variables
const DEEPGRAM_API_KEY = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY || '';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '';

// Demo mode when API keys are not configured
const DEMO_MODE = !DEEPGRAM_API_KEY || !OPENROUTER_API_KEY;

export default function TranslateScreen() {
  const { languageCode, languageName } = useLocalSearchParams<{
    languageCode: string;
    languageName: string;
  }>();
  const router = useRouter();

  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startRecording, stopRecording, isRecording, hasPermission, requestPermission } = useAudioRecording();

  const deepgramRef = useRef<DeepgramService | null>(null);
  const translationRef = useRef<TranslationService | null>(null);
  const transcriptionBufferRef = useRef('');
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation values
  const micScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    // Initialize services
    if (DEEPGRAM_API_KEY) {
      deepgramRef.current = new DeepgramService(DEEPGRAM_API_KEY);
    }
    if (OPENROUTER_API_KEY) {
      translationRef.current = new TranslationService(OPENROUTER_API_KEY);
    }

    return () => {
      deepgramRef.current?.stop();
    };
  }, []);

  const micAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const handleToggleListen = async () => {
    if (DEMO_MODE) {
      Alert.alert(
        'Demo Mode',
        'API keys are not configured. Please set EXPO_PUBLIC_DEEPGRAM_API_KEY and EXPO_PUBLIC_OPENROUTER_API_KEY in your .env file.\n\nCheck README.md for setup instructions.',
        [{ text: 'OK' }]
      );
      // For demo purposes, show sample data
      setTranscription('Hello, how are you today? This is a demo transcription.');
      setTimeout(() => {
        setTranslation(`Hola, ¿cómo estás hoy? Esta es una traducción de demostración.`);
      }, 1000);
      return;
    }

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required to use Murmur.');
        return;
      }
    }

    if (isListening) {
      // Stop listening
      setIsListening(false);
      deepgramRef.current?.stop();
      await stopRecording();

      micScale.value = withSpring(1);
      pulseOpacity.value = withSpring(0);
    } else {
      // Start listening
      setIsListening(true);
      setError(null);
      setTranscription('');
      setTranslation('');
      transcriptionBufferRef.current = '';

      // Animate microphone
      micScale.value = withRepeat(
        withSequence(
          withSpring(1.1),
          withSpring(0.95)
        ),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withSpring(0.5),
          withSpring(0)
        ),
        -1,
        false
      );

      try {
        // Start Deepgram streaming
        await deepgramRef.current?.startStreaming(
          (transcript) => {
            // Update transcription
            setTranscription(prev => {
              const newText = prev + ' ' + transcript;
              transcriptionBufferRef.current = newText;

              // Debounce translation
              if (translationTimeoutRef.current) {
                clearTimeout(translationTimeoutRef.current);
              }

              translationTimeoutRef.current = setTimeout(() => {
                handleTranslate(newText.trim());
              }, 1000);

              return newText;
            });
          },
          (error) => {
            console.error('Deepgram error:', error);
            setError(error.message);
            setIsListening(false);
          }
        );

        // Start audio recording
        await startRecording((audioData) => {
          deepgramRef.current?.sendAudio(audioData);
        });
      } catch (err) {
        console.error('Error starting recording:', err);
        setError((err as Error).message);
        setIsListening(false);
      }
    }
  };

  const handleTranslate = async (text: string) => {
    if (!text || !translationRef.current || !languageName) return;

    let currentTranslation = '';
    setTranslation('');

    await translationRef.current.translateStream(
      text,
      languageName,
      (chunk) => {
        currentTranslation += chunk;
        setTranslation(currentTranslation);
      },
      (fullText) => {
        setTranslation(fullText);
      },
      (error) => {
        console.error('Translation error:', error);
        setError(error.message);
      }
    );
  };

  return (
    <LinearGradient
      colors={['#faf5ff', '#fce7f3', '#eff6ff']}
      style={{ flex: 1 }}
    >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="pt-16 px-6 pb-4 border-b border-gray-200/50"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Pressable onPress={() => router.back()} className="active:opacity-50">
              <Text className="text-2xl">←</Text>
            </Pressable>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-500 mr-2">Translating to</Text>
              <Text className="text-base font-semibold text-gray-900">{languageName}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-6 pt-6"
          contentContainerStyle={{ paddingBottom: 200 }}
        >
          {/* Transcription */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            className="mb-6"
          >
            <Text className="text-sm font-semibold text-gray-500 mb-3">Original</Text>
            <View className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 min-h-[120px] shadow-sm">
              <Text className="text-base text-gray-900 leading-relaxed">
                {transcription || 'Tap the microphone to start speaking...'}
              </Text>
            </View>
          </Animated.View>

          {/* Translation */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            className="mb-6"
          >
            <Text className="text-sm font-semibold text-gray-500 mb-3">Translation</Text>
            <View className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-5 min-h-[120px] shadow-sm">
              <Text className="text-base text-gray-900 leading-relaxed">
                {translation || 'Translation will appear here...'}
              </Text>
            </View>
          </Animated.View>

          {/* Error */}
          {error && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="bg-red-100 border border-red-300 rounded-xl p-4 mb-4"
            >
              <Text className="text-red-800 text-sm">{error}</Text>
            </Animated.View>
          )}
        </ScrollView>

        {/* Microphone Button */}
        <View className="absolute bottom-0 left-0 right-0 pb-12 pt-6 px-6 bg-gradient-to-t from-purple-50 to-transparent">
          <Animated.View style={pulseAnimatedStyle} className="absolute inset-0 items-center justify-center">
            <View className="w-32 h-32 bg-purple-300 rounded-full opacity-30" />
          </Animated.View>

          <AnimatedPressable
            style={micAnimatedStyle}
            onPress={handleToggleListen}
            className={`w-24 h-24 rounded-full items-center justify-center self-center shadow-xl active:scale-95 ${
              isListening
                ? 'bg-gradient-to-br from-red-400 to-pink-500'
                : 'bg-gradient-to-br from-purple-500 to-pink-500'
            }`}
          >
            <Text className="text-5xl">{isListening ? '⏸' : '🎙️'}</Text>
          </AnimatedPressable>

          <Text className="text-center text-gray-600 mt-4 text-sm">
            {isListening ? 'Listening... Tap to stop' : 'Tap to start speaking'}
          </Text>
        </View>
    </LinearGradient>
  );
}
