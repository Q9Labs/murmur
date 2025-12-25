import React, { useRef, useState, useCallback } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { OnboardingSlide } from "@/components/ui/OnboardingSlide";
import { GradientButton } from "@/components/ui/GradientButton";
import { onboardingStorage } from "@/lib/onboarding";

const SLIDES = [
  {
    title: "Welcome to Murmur",
    description:
      "Break down language barriers with AI-powered real-time translation. Speak naturally, understand instantly.",
    icon: "globe",
    iconColor: "#FF784F",
  },
  {
    title: "Real-Time Translation",
    description:
      "Your voice becomes speech-to-text in milliseconds, then instantly translated. No delays, no friction.",
    icon: "zap",
    iconColor: "#DB9D47",
  },
  {
    title: "12+ Languages",
    description:
      "Translate between Spanish, French, German, Italian, Portuguese, Japanese, Chinese, Korean, Arabic, Russian, Hindi, and Dutch.",
    icon: "flag",
    iconColor: "#7B68EE",
  },
  {
    title: "Powered by AI",
    description:
      "Built with advanced speech recognition and Claude AI translation. Quality you can trust, speed you can rely on.",
    icon: "cpu",
    iconColor: "#FF784F",
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function Onboarding() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);

  const handleNext = useCallback(async () => {
    if (currentSlide < SLIDES.length - 1) {
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      scrollViewRef.current?.scrollTo({
        x: nextSlide * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      // Mark onboarding as completed and navigate
      await onboardingStorage.markAsCompleted();
      router.replace("/language-selection");
    }
  }, [currentSlide, router]);

  const handleSkip = useCallback(async () => {
    await onboardingStorage.markAsCompleted();
    router.replace("/language-selection");
  }, [router]);

  const handleMomentumScrollEnd = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const newSlide = Math.round(x / SCREEN_WIDTH);
    if (newSlide !== currentSlide) {
      setCurrentSlide(newSlide);
    }
  };

  const isLastSlide = currentSlide === SLIDES.length - 1;
  const buttonTitle = isLastSlide ? "Get Started" : "Next";

  return (
    <LinearGradient
      colors={["#FFFBF7", "#FFE19C", "#EDFFD9"]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
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
        {SLIDES.map((slide, index) => (
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
        ))}
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
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  index === currentSlide
                    ? "#FF784F"
                    : "rgba(255, 120, 79, 0.3)",
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
              className="flex-1 items-center justify-center py-4 border border-white/40 rounded-2xl bg-white/30 backdrop-blur-sm"
            >
              <Feather name="arrow-left" size={20} color="#3A3042" />
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
          {currentSlide + 1} of {SLIDES.length}
        </Animated.Text>
      </Animated.View>
    </LinearGradient>
  );
}
