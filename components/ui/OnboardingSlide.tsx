import { theme } from "@/lib/theme";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

interface OnboardingSlideProps {
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  highlighted?: string;
  delay?: number;
}

export function OnboardingSlide({
  title,
  description,
  icon,
  iconColor = theme.colors.coral,
  highlighted,
  delay = 0,
}: OnboardingSlideProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* Icon Circle */}
      <Animated.View
        entering={FadeIn.duration(500).delay(delay)}
        style={{
          width: theme.onboarding.iconCircle.size,
          height: theme.onboarding.iconCircle.size,
          borderRadius: theme.onboarding.iconCircle.borderRadius,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: theme.spacing["3xl"],
          backgroundColor: theme.colors.whiteTransparent.subtle,
          borderWidth: 1,
          borderColor: theme.colors.whiteTransparent.light,
        }}
        className="backdrop-blur-sm"
      >
        <Feather
          name={icon}
          size={theme.onboarding.iconSize}
          color={iconColor}
        />
      </Animated.View>

      {/* Title */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(delay + 100)}
        className="w-full mb-4"
      >
        <Text
          style={{
            fontSize: theme.onboarding.titleFontSize,
            fontWeight: "700",
            color: theme.colors.text.primary,
            textAlign: "center",
            letterSpacing: -0.5,
          }}
        >
          {title}
        </Text>
      </Animated.View>

      {/* Description */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(delay + 200)}
        className="w-full"
      >
        <Text
          style={{
            fontSize: theme.onboarding.descriptionFontSize,
            color: theme.colors.text.secondary,
            textAlign: "center",
            lineHeight: theme.onboarding.descriptionFontSize * theme.typography.lineHeight.relaxed,
          }}
        >
          {description}
          {highlighted && (
            <Text
              style={{
                fontWeight: "600",
                color: theme.colors.text.primary,
              }}
            >
              {highlighted}
            </Text>
          )}
        </Text>
      </Animated.View>
    </View>
  );
}
