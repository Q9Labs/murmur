import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GradientButton } from "@/components/ui/GradientButton";
import { OnboardingSlide } from "@/components/ui/OnboardingSlide";
import { onboardingStorage } from "@/lib/onboarding";
import { theme } from "@/lib/theme";

const SLIDES = [
  {
    title: "Welcome to Murmur",
    description:
      "Break down language barriers with AI-powered real-time translation. Speak naturally, understand instantly.",
    icon: "globe",
    iconColor: theme.colors.coral,
  },
  {
    title: "Real-Time Translation",
    description:
      "Your voice becomes speech-to-text in milliseconds, then instantly translated. No delays, no friction.",
    icon: "zap",
    iconColor: theme.colors.gold,
  },
  {
    title: "12+ Languages",
    description:
      "Translate between Spanish, French, German, Italian, Portuguese, Japanese, Chinese, Korean, Arabic, Russian, Hindi, and Dutch.",
    icon: "flag",
    iconColor: theme.colors.coral,
  },
  {
    title: "Powered by AI",
    description:
      "Built with advanced speech recognition and Claude AI translation. Quality you can trust, speed you can rely on.",
    icon: "cpu",
    iconColor: theme.colors.gold,
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function OnboardingContent(): ReactNode {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const isMountedRef = useRef(true);

  const handleNext = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      if (currentSlide < SLIDES.length - 1) {
        const nextSlide = currentSlide + 1;
        setCurrentSlide(nextSlide);
        scrollViewRef.current?.scrollTo({
          x: nextSlide * SCREEN_WIDTH,
          animated: true,
        });
      } else {
        // Mark onboarding as completed and navigate
        try {
          await onboardingStorage.markAsCompleted();
          if (isMountedRef.current && router) {
            router.replace("/language-selection");
          }
        } catch (storageError) {
          console.error(
            "[Onboarding] Error marking onboarding as completed:",
            storageError,
          );
          Alert.alert("Error", "Failed to save progress. Please try again.");
        }
      }
    } catch (error) {
      console.error("[Onboarding] Error in handleNext:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    }
  }, [currentSlide, router]);

  const handleSkip = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      await onboardingStorage.markAsCompleted();
      if (isMountedRef.current && router) {
        router.replace("/language-selection");
      }
    } catch (error) {
      console.error("[Onboarding] Error in handleSkip:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Failed to skip onboarding. Please try again.");
      }
    }
  }, [router]);

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    try {
      if (!isMountedRef.current) return;

      const x = event?.nativeEvent?.contentOffset?.x ?? 0;
      const newSlide = Math.round(x / SCREEN_WIDTH);
      if (
        newSlide !== currentSlide &&
        newSlide >= 0 &&
        newSlide < SLIDES.length
      ) {
        setCurrentSlide(newSlide);
      }
    } catch (error) {
      console.error("[Onboarding] Error in handleMomentumScrollEnd:", error);
    }
  };

  const isLastSlide = currentSlide === SLIDES.length - 1;
  const buttonTitle = isLastSlide ? "Get Started" : "Next";

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <LinearGradient
      colors={theme.gradients.background.colors as [string, string, string]}
      locations={theme.gradients.background.locations}
      start={theme.gradients.background.start}
      end={theme.gradients.background.end}
      style={{ flex: 1 }}
    >
      {/* Skip Button */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(300)}
        className="absolute top-12 right-6 z-10"
      >
        <Pressable onPress={handleSkip}>
          <Text className="text-base font-semibold text-ink-secondary">
            Skip
          </Text>
        </Pressable>
      </Animated.View>

      {/* Slides Container */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {SLIDES && SLIDES.length > 0
          ? SLIDES.map((slide, index) => {
              if (!slide) return null;

              return (
                <View
                  key={`slide-${index}`}
                  style={{ width: SCREEN_WIDTH, flex: 1 }}
                  className="pt-32"
                >
                  <OnboardingSlide
                    title={slide.title}
                    description={slide.description}
                    icon={slide.icon as any}
                    iconColor={slide.iconColor}
                    delay={100}
                  />
                </View>
              );
            })
          : null}
      </Animated.ScrollView>

      {/* Bottom Section with Dots and Buttons */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(600)}
        className="px-6 pb-12"
      >
        {/* Progress Dots */}
        <View className="flex-row justify-center items-center gap-2 mb-12">
          {SLIDES.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={{
                width: theme.dot.small,
                height: theme.dot.small,
                borderRadius: theme.dot.small / 2,
                backgroundColor:
                  index === currentSlide
                    ? theme.colors.coral
                    : theme.colors.coralMuted,
              }}
            />
          ))}
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3">
          {currentSlide > 0 && (
            <Pressable
              onPress={() => {
                const prevSlide = currentSlide - 1;
                setCurrentSlide(prevSlide);
                scrollViewRef.current?.scrollTo({
                  x: prevSlide * SCREEN_WIDTH,
                  animated: true,
                });
              }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: theme.spacing.lg,
                borderWidth: 1,
                borderColor: theme.colors.glass.defaultBorder,
                borderRadius: theme.borderRadius.xl,
                backgroundColor: theme.colors.whiteTransparent.veryLight,
              }}
              className="backdrop-blur-sm"
            >
              <Feather
                name="arrow-left"
                size={20}
                color={theme.colors.text.primary}
              />
            </Pressable>
          )}

          <View style={{ flex: currentSlide > 0 ? 1 : 0 }} className="flex-1">
            <GradientButton
              title={buttonTitle}
              icon={isLastSlide ? "check-circle" : "arrow-right"}
              onPress={handleNext}
            />
          </View>
        </View>

        {/* Slide Counter */}
        <Animated.Text
          entering={FadeInDown.duration(500).delay(700)}
          className="text-center text-sm font-medium text-ink-muted mt-4"
        >
          {currentSlide + 1} of {SLIDES?.length ?? 0}
        </Animated.Text>
      </Animated.View>
    </LinearGradient>
  );
}

export default function Onboarding(): ReactNode {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error("[Onboarding] ErrorBoundary caught error:", error);
      }}
    >
      <OnboardingContent />
    </ErrorBoundary>
  );
}
