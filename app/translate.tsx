import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedMicButton, GlassCard, IconButton } from "@/components/ui";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { theme } from "@/lib/theme";
import { DeepgramService } from "@/services/deepgram";
import { TranslationService } from "@/services/translation";

const DEEPGRAM_API_KEY = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY || "";
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || "";
const DEMO_MODE = !DEEPGRAM_API_KEY || !OPENROUTER_API_KEY;

function TypingIndicator(): ReactNode {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(
      withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    setTimeout(() => {
      dot2.value = withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }, 150);
    setTimeout(() => {
      dot3.value = withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }, 300);
  }, []);

  const dotStyle1 = useAnimatedStyle(() => ({
    opacity: 0.3 + dot1.value * 0.7,
  }));
  const dotStyle2 = useAnimatedStyle(() => ({
    opacity: 0.3 + dot2.value * 0.7,
  }));
  const dotStyle3 = useAnimatedStyle(() => ({
    opacity: 0.3 + dot3.value * 0.7,
  }));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Animated.View
        style={[
          {
            width: theme.dot.small,
            height: theme.dot.small,
            borderRadius: theme.dot.small / 2,
            backgroundColor: theme.colors.coral,
          },
          dotStyle1,
        ]}
      />
      <Animated.View
        style={[
          {
            width: theme.dot.small,
            height: theme.dot.small,
            borderRadius: theme.dot.small / 2,
            backgroundColor: theme.colors.coral,
          },
          dotStyle2,
        ]}
      />
      <Animated.View
        style={[
          {
            width: theme.dot.small,
            height: theme.dot.small,
            borderRadius: theme.dot.small / 2,
            backgroundColor: theme.colors.coral,
          },
          dotStyle3,
        ]}
      />
    </View>
  );
}

function TranslateScreenContent(): ReactNode {
  const { languageName } = useLocalSearchParams<{
    languageCode: string;
    languageName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [transcription, setTranscription] = useState<string>("");
  const [translation, setTranslation] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [micContainerHeight, setMicContainerHeight] = useState<number>(0);

  const { startRecording, stopRecording, hasPermission, requestPermission } =
    useAudioRecording();

  const deepgramRef = useRef<DeepgramService | null>(null);
  const translationRef = useRef<TranslationService | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3;
  const isMountedRef = useRef<boolean>(true);
  const transcriptionScrollRef = useRef<ScrollView>(null);
  const translationScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (DEEPGRAM_API_KEY) {
      deepgramRef.current = new DeepgramService(DEEPGRAM_API_KEY);
    }
    if (OPENROUTER_API_KEY) {
      translationRef.current = new TranslationService(OPENROUTER_API_KEY);
    }

    return () => {
      isMountedRef.current = false;
      deepgramRef.current?.stop();
      retryCountRef.current = 0;
    };
  }, []);

  // Auto-scroll transcription to bottom when new content arrives
  useEffect(() => {
    if (transcription && transcriptionScrollRef.current) {
      setTimeout(() => {
        transcriptionScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcription]);

  // Auto-scroll translation to bottom when new chunks arrive
  useEffect(() => {
    if (translation && translationScrollRef.current) {
      setTimeout(() => {
        translationScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [translation]);

  const handleTranslate = useCallback(
    async (text: string): Promise<void> => {
      if (
        !text?.trim() ||
        !translationRef.current ||
        !languageName ||
        !isMountedRef.current
      )
        return;

      try {
        if (!isMountedRef.current) return;
        setIsTranslating(true);
        setTranslation("");

        let result = "";
        await translationRef.current.translateStream(
          text.trim(),
          languageName,
          (chunk: string) => {
            try {
              if (isMountedRef.current) {
                result += chunk;
                setTranslation(result);
              }
            } catch (error) {
              console.error("Error updating translation chunk:", error);
            }
          },
          (fullText: string) => {
            try {
              if (isMountedRef.current) {
                setTranslation(fullText);
                setIsTranslating(false);
              }
            } catch (error) {
              console.error("Error updating final translation:", error);
            }
          },
          (err: Error) => {
            try {
              if (isMountedRef.current) {
                console.error("Translation error:", err);
                setError("Translation failed. Please try again.");
                setIsTranslating(false);
              }
            } catch (error) {
              console.error("Error handling translation error:", error);
            }
          },
        );
      } catch (err) {
        console.error("Translation exception:", err);
        if (isMountedRef.current) {
          setError("Translation failed. Please try again.");
          setIsTranslating(false);
        }
      }
    },
    [languageName],
  );

  const startListening = useCallback(async (): Promise<void> => {
    if (!deepgramRef.current) {
      if (isMountedRef.current) {
        setError("Service not initialized");
      }
      return;
    }

    if (!isMountedRef.current) return;

    try {
      if (isMountedRef.current) {
        setIsConnecting(true);
        setError(null);
        setTranscription("");
        setTranslation("");
      }

      await deepgramRef.current.startStreaming({
        onTranscript: (text: string, isFinal: boolean) => {
          try {
            if (isMountedRef.current && isFinal) {
              setTranscription((prev) => (prev ? prev + " " + text : text));
            }
          } catch (error) {
            console.error("Error updating transcript:", error);
          }
        },
        onSpeechFinal: (fullTranscript: string) => {
          try {
            if (isMountedRef.current) {
              setTranscription(fullTranscript);
              handleTranslate(fullTranscript);
            }
          } catch (error) {
            console.error("Error handling speech final:", error);
          }
        },
        onUtteranceEnd: () => {
          try {
            if (isMountedRef.current) {
              const accumulated =
                deepgramRef.current?.getAccumulatedTranscript();
              if (accumulated?.trim()) {
                handleTranslate(accumulated);
              }
            }
          } catch (error) {
            console.error("Error handling utterance end:", error);
          }
        },
        onSpeakingChange: (speaking: boolean) => {
          try {
            if (isMountedRef.current) {
              setIsSpeaking(speaking);
            }
          } catch (error) {
            console.error("Error updating speaking state:", error);
          }
        },
        onError: (err: Error) => {
          try {
            if (!isMountedRef.current) return;
            console.error("Deepgram error:", err);
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              console.log(
                `Retrying... (${retryCountRef.current}/${maxRetries})`,
              );
              setTimeout(() => {
                if (isMountedRef.current) {
                  startListening();
                }
              }, 1000);
            } else {
              setError("Connection failed. Please try again.");
              setIsListening(false);
              setIsConnecting(false);
              retryCountRef.current = 0;
            }
          } catch (error) {
            console.error("Error handling deepgram error:", error);
          }
        },
      });

      if (isMountedRef.current) {
        setIsConnecting(false);
        setIsListening(true);
        retryCountRef.current = 0;
      }

      await startRecording((audioData: ArrayBuffer) => {
        try {
          if (isMountedRef.current && deepgramRef.current?.isAlive()) {
            deepgramRef.current.sendAudio(audioData);
          }
        } catch (error) {
          console.error("Error sending audio:", error);
        }
      });
    } catch (err) {
      console.error("Start error:", err);
      if (isMountedRef.current) {
        setError("Failed to start. Please try again.");
        setIsListening(false);
        setIsConnecting(false);
      }
    }
  }, [handleTranslate, startRecording]);

  const stopListening = useCallback(async (): Promise<void> => {
    try {
      if (isMountedRef.current) {
        setIsListening(false);
        setIsSpeaking(false);
      }
      deepgramRef.current?.stop();
      await stopRecording();
    } catch (error) {
      console.error("Error stopping listening:", error);
      if (isMountedRef.current) {
        setError("Error stopping recording. Please try again.");
      }
    }
  }, [stopRecording]);

  const handleToggleListen = async (): Promise<void> => {
    if (!isMountedRef.current) return;

    try {
      if (DEMO_MODE) {
        Alert.alert("Demo Mode", "API keys not configured.");
        if (isMountedRef.current) {
          setTranscription("Hello, how are you?");
          setIsTranslating(true);
          setTimeout(() => {
            if (isMountedRef.current) {
              setTranslation("Hola, ¿cómo estás?");
              setIsTranslating(false);
            }
          }, 1500);
        }
        return;
      }

      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert(
            "Permission Denied",
            "Microphone permission is required.",
          );
          return;
        }
      }

      if (isListening) {
        await stopListening();
      } else {
        await startListening();
      }
    } catch (error) {
      console.error("Error toggling listen:", error);
      if (isMountedRef.current) {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  };

  const getStatusText = (): string => {
    if (isConnecting) return "Connecting...";
    if (!isListening) return "Tap to start speaking";
    if (isSpeaking) return "Listening...";
    return "Speak now...";
  };

  return (
    <LinearGradient
      colors={theme.gradients.background.colors as [string, string, string]}
      locations={theme.gradients.background.locations}
      start={theme.gradients.background.start}
      end={theme.gradients.background.end}
      style={{ flex: 1 }}
    >
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        className="pt-14 px-6 pb-4"
      >
        <View className="flex-row items-center justify-between">
          <IconButton
            icon="chevron-left"
            onPress={() => router.back()}
            size="md"
            variant="glass"
          />
          <View className="flex-row items-center bg-coral/15 px-4 py-2 rounded-full">
            <Text className="text-sm text-ink-secondary mr-1">
              Translating to
            </Text>
            <Text className="text-sm font-bold text-coral">{languageName}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Content - Scrollable with dynamic bottom padding based on mic container height */}
      <ScrollView
        ref={translationScrollRef}
        className="flex-1 px-6"
        contentContainerStyle={{
          paddingBottom: Math.max(micContainerHeight + 16, 100),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Transcription Card */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="mb-5"
        >
          <View className="flex-row items-center mb-2 ml-1">
            <Text className="text-xs font-bold text-ink-muted uppercase tracking-wider">
              Original
            </Text>
            {isSpeaking && (
              <View className="ml-2 flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-coral mr-1" />
                <Text className="text-xs text-coral">Listening</Text>
              </View>
            )}
          </View>
          <GlassCard className="p-4">
            {transcription ? (
              <Text className="text-base leading-relaxed text-ink">
                {transcription}
              </Text>
            ) : (
              <Text className="text-base text-ink-muted italic">
                {isListening ? "Listening..." : "Tap mic to speak"}
              </Text>
            )}
          </GlassCard>
        </Animated.View>

        {/* Translation Card */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          className="mb-5"
        >
          <View className="flex-row items-center mb-2 ml-1">
            <Text className="text-xs font-bold text-coral uppercase tracking-wider">
              Translation
            </Text>
            {isTranslating && (
              <View className="ml-2">
                <ActivityIndicator size="small" color={theme.colors.coral} />
              </View>
            )}
          </View>
          <View className="rounded-3xl overflow-hidden border border-coral/20 shadow-soft">
            <LinearGradient
              colors={["rgba(255, 120, 79, 0.08)", "rgba(219, 157, 71, 0.08)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20, minHeight: 120 }}
            >
              {translation ? (
                <Text className="text-base leading-relaxed text-ink">
                  {translation}
                </Text>
              ) : isTranslating ? (
                <View className="flex-row items-center">
                  <Text className="text-base text-ink-muted italic mr-2">
                    Translating
                  </Text>
                  <TypingIndicator />
                </View>
              ) : (
                <Text className="text-base text-ink-muted italic">
                  Translation will appear here...
                </Text>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Error */}
        {error && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4"
          >
            <Text className="text-red-700 text-sm font-medium">{error}</Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Microphone Button Area - Positioned at bottom with solid background and top border */}
      <View
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          setMicContainerHeight(height);
        }}
        style={{
          backgroundColor: theme.colors.pastel.cream,
          borderTopWidth: 1,
          borderTopColor: theme.colors.glass.defaultBorder,
          paddingTop: 24,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          alignItems: "center",
        }}
      >
        {isConnecting ? (
          <View className="w-20 h-20 rounded-full bg-white/80 items-center justify-center shadow-elevated">
            <ActivityIndicator size="large" color={theme.colors.coral} />
          </View>
        ) : (
          <AnimatedMicButton
            isListening={isListening}
            onPress={handleToggleListen}
          />
        )}

        <Text className="text-sm font-medium text-ink-secondary mt-4">
          {getStatusText()}
        </Text>
      </View>
    </LinearGradient>
  );
}

export default function TranslateScreen(): ReactNode {
  return (
    <ErrorBoundary
      onError={(error: Error) => {
        console.error("[TranslateScreen] ErrorBoundary caught error:", error);
      }}
    >
      <TranslateScreenContent />
    </ErrorBoundary>
  );
}
