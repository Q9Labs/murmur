import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedMicButton, GlassCard, IconButton } from "@/components/ui";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { theme } from "@/lib/theme";
import { DeepgramService } from "@/services/deepgram";
import { TranslationService } from "@/services/translation";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { ActivityIndicator, Alert, Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function AuroraBlob({
  color,
  size,
  initialX,
  initialY,
  delay = 0,
}: {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  delay?: number;
}): ReactNode {
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(initialX + 30, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(initialX - 30, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(initialY - 30, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        withTiming(initialY + 30, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 3000 }),
        withTiming(0.12, { duration: 3000 }),
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
      }}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          animatedStyle,
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

  const { startRecording, stopRecording, hasPermission, requestPermission } =
    useAudioRecording();

  const deepgramRef = useRef<DeepgramService | null>(null);
  const translationRef = useRef<TranslationService | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3;
  const isMountedRef = useRef<boolean>(true);
  const contentScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (DEEPGRAM_API_KEY) {
      deepgramRef.current = new DeepgramService(DEEPGRAM_API_KEY);
    }
    if (OPENROUTER_API_KEY) {
      translationRef.current = new TranslationService(OPENROUTER_API_KEY);
    }

    return () => {
      isMountedRef.current = false;
      if (deepgramRef.current) {
        deepgramRef.current.stop();
      }
      retryCountRef.current = 0;
    };
  }, []);

  // Auto-scroll content to bottom
  useEffect(() => {
    if ((transcription || translation) && contentScrollRef.current) {
      const timeout = setTimeout(() => {
        if (isMountedRef.current) {
          contentScrollRef.current?.scrollToEnd({ animated: true });
        }
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [transcription, translation]);

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
        setError(null);

        let result = "";
        await translationRef.current.translateStream(
          text.trim(),
          languageName,
          (chunk: string) => {
            if (isMountedRef.current) {
              result += chunk;
              setTranslation(result);
            }
          },
          (fullText: string) => {
            if (isMountedRef.current) {
              setTranslation(fullText);
              setIsTranslating(false);
            }
          },
          (err: Error) => {
            if (isMountedRef.current) {
              console.error("Translation error:", err);
              setError(`Translation failed: ${err.message || "Please try again"}`);
              setIsTranslating(false);
            }
          },
        );
      } catch (err) {
        console.error("Translation exception:", err);
        if (isMountedRef.current) {
          setError("Translation failed. Check your network and try again.");
          setIsTranslating(false);
        }
      }
    },
    [languageName],
  );

  const startListening = useCallback(async (): Promise<void> => {
    if (!deepgramRef.current || !isMountedRef.current) return;

    try {
      setIsConnecting(true);
      setError(null);
      setTranscription("");
      setTranslation("");

      await deepgramRef.current.startStreaming({
        onTranscript: (text: string, isFinal: boolean) => {
          if (isMountedRef.current && isFinal) {
            setTranscription((prev) => (prev ? prev + " " + text : text));
          }
        },
        onSpeechFinal: (fullTranscript: string) => {
          if (isMountedRef.current) {
            setTranscription(fullTranscript);
            handleTranslate(fullTranscript);
          }
        },
        onUtteranceEnd: () => {
          if (isMountedRef.current) {
            const accumulated = deepgramRef.current?.getAccumulatedTranscript();
            if (accumulated?.trim()) {
              handleTranslate(accumulated);
            }
          }
        },
        onSpeakingChange: (speaking: boolean) => {
          if (isMountedRef.current) {
            setIsSpeaking(speaking);
          }
        },
        onError: (err: Error) => {
          if (!isMountedRef.current) return;
          console.error("Deepgram error:", err);
          
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            setTimeout(() => {
              if (isMountedRef.current) startListening();
            }, 1000);
          } else {
            setError("Connection failed. Please try again.");
            setIsListening(false);
            setIsConnecting(false);
            retryCountRef.current = 0;
          }
        },
      });

      if (isMountedRef.current) {
        setIsConnecting(false);
        setIsListening(true);
        retryCountRef.current = 0;
      }

      await startRecording((audioData: ArrayBuffer) => {
        if (isMountedRef.current && deepgramRef.current?.isAlive()) {
          deepgramRef.current.sendAudio(audioData);
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
    if (isMountedRef.current) {
      setIsListening(false);
      setIsSpeaking(false);
    }
    deepgramRef.current?.stop();
    await stopRecording();
  }, [stopRecording]);

  const handleToggleListen = async (): Promise<void> => {
    if (DEMO_MODE) {
      Alert.alert("Demo Mode", "API keys not configured.");
      setTranscription("Hello world");
      setTranslation("Hola mundo");
      return;
    }

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  return (
    <LinearGradient
      colors={theme.gradients.background.colors as [string, string, string]}
      locations={theme.gradients.background.locations}
      start={theme.gradients.background.start}
      end={theme.gradients.background.end}
      style={{ flex: 1 }}
    >
      {/* Aurora Blobs */}
      <AuroraBlob color={theme.colors.coral} size={400} initialX={-200} initialY={50} delay={0} />
      <AuroraBlob color={theme.colors.gold} size={350} initialX={SCREEN_WIDTH - 100} initialY={200} delay={1000} />
      <AuroraBlob color={theme.colors.gold} size={300} initialX={SCREEN_WIDTH / 2 - 150} initialY={SCREEN_HEIGHT - 350} delay={2000} />

      {/* Header */}
      <Animated.View 
        entering={FadeIn.duration(400)} 
        className="pt-12 px-6 pb-2 flex-row items-center justify-between z-20"
        style={{ height: 110 }}
      >
        <View style={{ width: 50, height: 50, justifyContent: "center" }}>
          <IconButton icon="arrow-left" onPress={() => router.back()} size="md" variant="glass" />
        </View>
        
        <Pressable 
          onPress={() => router.replace("/language-selection")}
          style={{ 
            backgroundColor: "rgba(255, 255, 255, 0.75)", 
            paddingHorizontal: 28, 
            paddingVertical: 12, 
            borderRadius: 30,
            borderWidth: 1.5,
            borderColor: "rgba(255, 255, 255, 0.6)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
          }}
          className="backdrop-blur-md active:scale-95"
        >
          <Text style={{ color: theme.colors.text.secondary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>
            To <Text style={{ color: theme.colors.coral, fontWeight: "900" }}>{languageName}</Text>
          </Text>
        </Pressable>

        <View style={{ width: 50, height: 50, justifyContent: "center", alignItems: "flex-end" }}>
          <IconButton icon="more-horizontal" onPress={() => {}} size="md" variant="glass" />
        </View>
      </Animated.View>

      {/* Content Area */}
      <View style={{ flex: 1 }} className="z-20">
        <ScrollView
          ref={contentScrollRef}
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Masterpiece Card */}
          <GlassCard 
            className="p-0 border-white/50" 
            style={{ 
              borderRadius: 48, 
              overflow: "hidden", 
              backgroundColor: "rgba(255, 255, 255, 0.6)",
              minHeight: SCREEN_HEIGHT * 0.62,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 24 },
              shadowOpacity: 0.12,
              shadowRadius: 32,
              elevation: 18,
            }}
          >
            {/* Input Section */}
            <View className="px-10 py-12 border-b border-black/5">
              <View className="flex-row items-center mb-8">
                <View className="w-1.5 h-4.5 bg-gold/70 rounded-full mr-4" />
                <Text style={{ 
                  color: theme.colors.text.muted, 
                  fontSize: 11, 
                  fontWeight: "900", 
                  letterSpacing: 3,
                  textTransform: "uppercase"
                }}>
                  You Said
                </Text>
                {isSpeaking && (
                   <Animated.View entering={FadeIn} className="ml-auto flex-row items-center bg-coral/20 px-4 py-1.5 rounded-full">
                     <View className="w-2.5 h-2.5 rounded-full bg-coral mr-2" />
                     <Text style={{ color: theme.colors.coral, fontSize: 11, fontWeight: "900" }}>LIVE</Text>
                   </Animated.View>
                )}
              </View>
              {transcription ? (
                <Text style={{ fontSize: 28, color: theme.colors.text.primary, lineHeight: 40, fontWeight: "500" }}>
                  {transcription}
                </Text>
              ) : (
                <Text style={{ fontSize: 28, color: "rgba(0,0,0,0.15)", fontStyle: "italic", fontWeight: "500" }}>
                  {isListening ? "Listening..." : "Tap the mic"}
                </Text>
              )}
            </View>

            {/* Output Section */}
            <LinearGradient
              colors={["rgba(255, 120, 79, 0.04)", "rgba(255, 255, 255, 0.06)"]}
              className="flex-1"
            >
              <View className="px-10 py-12">
                <View className="flex-row items-center mb-8">
                  <View className="w-1.5 h-4.5 bg-coral rounded-full mr-4" />
                  <Text style={{ 
                    color: theme.colors.coral, 
                    fontSize: 11, 
                    fontWeight: "900", 
                    letterSpacing: 3,
                    textTransform: "uppercase"
                  }}>
                    {languageName}
                  </Text>
                  {isTranslating && (
                     <View className="ml-auto">
                       <ActivityIndicator size="small" color={theme.colors.coral} />
                     </View>
                  )}
                </View>
                {translation ? (
                  <Text style={{ fontSize: 34, color: theme.colors.text.primary, lineHeight: 48, fontWeight: "700" }}>
                    {translation}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 34, color: "rgba(255, 120, 79, 0.08)", fontStyle: "italic", fontWeight: "700" }}>
                    ...
                  </Text>
                )}
              </View>
            </LinearGradient>
          </GlassCard>

          {/* Error */}
          {error && (
            <Animated.View entering={FadeInDown} className="mt-8 bg-black/5 backdrop-blur-xl border border-white/20 rounded-3xl p-6 flex-row items-center">
              <Feather name="alert-circle" size={22} color={theme.colors.error} className="mr-4" />
              <Text className="flex-1" style={{ color: theme.colors.error, fontWeight: "700", fontSize: 14 }}>{error}</Text>
            </Animated.View>
          )}
        </ScrollView>
      </View>

      {/* Floating Microphone Area */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: Math.max(insets.bottom, 24) + 10,
          alignItems: "center",
          backgroundColor: isListening ? "transparent" : "rgba(255,255,255,0.2)",
        }}
        className="z-30 pt-8"
      >
        {!isListening && (
           <View className="mb-6 items-center">
             <Text style={{ color: theme.colors.text.secondary, fontSize: 14, fontWeight: "600" }}>Ready when you are</Text>
           </View>
        )}
        
        {isConnecting ? (
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.colors.coral} />
          </View>
        ) : (
          <AnimatedMicButton
            isListening={isListening}
            onPress={handleToggleListen}
          />
        )}
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
