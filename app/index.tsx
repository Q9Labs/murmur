import { AnimatedLogo, GradientButton } from "@/components/ui";
import { theme } from "@/lib/theme";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

export default function Onboarding(): ReactNode {
  const router = useRouter();

  return (
    <LinearGradient
      colors={theme.gradients.background.colors as [string, string, string]}
      locations={theme.gradients.background.locations}
      start={theme.gradients.background.start}
      end={theme.gradients.background.end}
      style={{ flex: 1 }}
    >
      <View className="flex-1 px-8 pt-20 pb-12">
        {/* Spacer */}
        <View className="flex-[0.1]" />

        {/* Logo Section */}
        <Animated.View entering={FadeIn.duration(600)} className="items-center">
          <AnimatedLogo size="md" />

          {/* Title */}
          <Text className="text-5xl font-bold text-ink mt-8 text-center tracking-tight">
            Murmur
          </Text>

          {/* Subtitle */}
          <Text className="text-lg text-ink-secondary text-center mt-2 font-medium">
            Seamless AI Translation
          </Text>
        </Animated.View>

        {/* Spacer */}
        <View className="flex-[0.1]" />

        {/* Feature Pills */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          className="flex-row flex-wrap justify-center gap-3 mb-8"
        >
          <FeaturePill icon="globe" text="12+ Languages" delay={400} />
          <FeaturePill icon="zap" text="Real-time" delay={500} />
          <FeaturePill icon="cpu" text="AI Powered" delay={600} />
        </Animated.View>

        {/* Spacer to push button down */}
        <View className="flex-1" />

        {/* CTA Button */}
        <View className="w-full mb-4">
          <GradientButton
            title="Get Started"
            icon="arrow-right"
            onPress={() => router.push("/language-selection")}
            animated
            delay={700}
          />
        </View>

        {/* Footer */}
        <Animated.Text
          entering={FadeInDown.delay(800).duration(400)}
          className="text-ink-muted text-xs text-center font-medium"
        >
          Designed for connection
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

interface FeaturePillProps {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  delay: number;
}

function FeaturePill({ icon, text, delay }: FeaturePillProps): ReactNode {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      className="flex-row items-center bg-white/60 backdrop-blur-sm rounded-full px-4 py-2.5 border border-white/40 shadow-soft"
    >
      <View className="w-7 h-7 rounded-full bg-coral/15 items-center justify-center mr-2">
        <Feather name={icon} size={14} color="#FF784F" />
      </View>
      <Text className="text-sm font-semibold text-ink-secondary">{text}</Text>
    </Animated.View>
  );
}
