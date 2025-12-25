import { View, Text, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useState, useEffect, useRef, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { DeepgramService } from "@/services/deepgram";
import { TranslationService } from "@/services/translation";
import { IconButton, AnimatedMicButton, GlassCard } from "@/components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

const DEEPGRAM_API_KEY = process.env.EXPO_PUBLIC_DEEPGRAM_API_KEY || "";
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || "";
const DEMO_MODE = !DEEPGRAM_API_KEY || !OPENROUTER_API_KEY;

// Typing indicator component
function TypingIndicator() {
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

// Streaming cursor indicator - subtle blinking cursor
function StreamingCursor() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 2,
          height: 20,
          backgroundColor: theme.colors.coral,
          marginLeft: 2,
        },
        cursorStyle,
      ]}
    />
  );
}

export default function TranslateScreen() {
  const { languageCode, languageName } = useLocalSearchParams<{
    languageCode: string;
    languageName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [transcription, setTranscription] = useState("");
  const [translation, setTranslation] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(3);

  const { startRecording, stopRecording, hasPermission, requestPermission } =
    useAudioRecording();

  const deepgramRef = useRef<DeepgramService | null>(null);
  const translationRef = useRef<TranslationService | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const isMountedRef = useRef(true);
  const transcriptionScrollRef = useRef<ScrollView>(null);
  const translationScrollRef = useRef<ScrollView>(null);
  const activeTranslationRef = useRef(false);

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
    async (text: string) => {
      if (
        !text?.trim() ||
        !translationRef.current ||
        !languageName ||
        !isMountedRef.current
      )
        return;

      try {
        if (!isMountedRef.current) return;

        // Mark translation as active and clear previous result
        activeTranslationRef.current = true;
        setIsTranslating(true);
        setTranslation("");
        setError(null);

        let result = "";
        await translationRef.current.translateStream(
          text.trim(),
          languageName,
          (chunk) => {
            try {
              // Only update if this translation is still active
              if (isMountedRef.current && activeTranslationRef.current) {
                result += chunk;
                setTranslation(result);
              }
            } catch (error) {
              console.error("Error updating translation chunk:", error);
            }
          },
          (fullText) => {
            try {
              if (isMountedRef.current && activeTranslationRef.current) {
                setTranslation(fullText);
                setIsTranslating(false);
                activeTranslationRef.current = false;
              }
            } catch (error) {
              console.error("Error updating final translation:", error);
            }
          },
          (err) => {
            try {
              if (isMountedRef.current) {
                console.error("Translation error:", err);
                setError("Translation failed. Please try again.");
                setIsTranslating(false);
                activeTranslationRef.current = false;
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
          activeTranslationRef.current = false;
        }
      }
    },
    [languageName],
  );

  const startListening = useCallback(async () => {
    if (!deepgramRef.current) {
      if (isMountedRef.current) {
        setError("Service not initialized");
      }
      return;
    }

    if (!isMountedRef.current) return;

    try {
      if (isMountedRef.current) {
        // Mark any active translation as inactive
        activeTranslationRef.current = false;
        setIsConnecting(true);
        setError(null);
        setTranscription("");
        setTranslation("");
        setIsTranslating(false);
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
        onReconnecting: (
          isReconnecting: boolean,
          attemptNumber: number,
          maxAttempts: number,
        ) => {
          try {
            if (isMountedRef.current) {
              setIsReconnecting(isReconnecting);
              setReconnectAttempt(attemptNumber);
              setMaxReconnectAttempts(maxAttempts);
              if (isReconnecting) {
                console.log(
                  `[UI] Reconnecting to Deepgram (attempt ${attemptNumber}/${maxAttempts})`,
                );
              } else {
                console.log("[UI] Reconnection successful");
              }
            }
          } catch (error) {
            console.error("Error handling reconnecting state:", error);
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

      await startRecording((audioData) => {
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

  const stopListening = useCallback(async () => {
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

  const handleToggleListen = async () => {
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

  const getStatusText = () => {
    if (isReconnecting)
      return `Reconnecting... (${reconnectAttempt}/${maxReconnectAttempts})`;
    if (isConnecting) return "Connecting...";
    if (!isListening) return "Tap to start speaking";
    if (isSpeaking) return "Listening...";
    return "Speak now...";
  };

  return (
    <LinearGradient
      colors={theme.gradients.background.colors}
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
          {isReconnecting ? (
            <View className="flex-row items-center bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-full gap-2">
              <ActivityIndicator size="small" color="#EA9D47" />
              <Text className="text-sm text-yellow-700 font-medium">
                Reconnecting ({reconnectAttempt}/{maxReconnectAttempts})
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center bg-coral/15 px-4 py-2 rounded-full">
              <Text className="text-sm text-ink-secondary mr-1">
                Translating to
              </Text>
              <Text className="text-sm font-bold text-coral">
                {languageName}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Content - Scrollable with sufficient bottom padding */}
      <ScrollView
        ref={translationScrollRef}
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 200 }}
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
          <GlassCard className="p-5 min-h-[120px]">
            {transcription ? (
              <Text className="text-base leading-relaxed text-ink">
                {transcription}
              </Text>
            ) : isListening ? (
              <View className="flex-row items-center">
                <Text className="text-base text-ink-muted italic mr-2">
                  Waiting for speech
                </Text>
                <TypingIndicator />
              </View>
            ) : (
              <Text className="text-base text-ink-muted italic">
                Tap the microphone to start speaking...
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
              colors={theme.gradients.overlay.translationCard.colors}
              start={theme.gradients.overlay.translationCard.start}
              end={theme.gradients.overlay.translationCard.end}
              style={{ padding: 20, minHeight: 120 }}
            >
              {translation ? (
                <View className="flex-row flex-wrap items-center">
                  <Text className="text-base leading-relaxed text-ink">
                    {translation}
                  </Text>
                  {isTranslating && <StreamingCursor />}
                </View>
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

      {/* Microphone Button Area - Positioned at bottom without overlapping content */}
      <View
        className="items-center pt-6 px-6"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        <LinearGradient
          colors={theme.gradients.overlay.bottomFade.colors}
          locations={theme.gradients.overlay.bottomFade.locations}
          className="absolute inset-0"
        />

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
