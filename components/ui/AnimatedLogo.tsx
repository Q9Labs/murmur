import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { theme } from "@/lib/theme";

interface AnimatedLogoProps {
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { outer: 96, middle: 72, inner: 52, icon: 24 },
  md: { outer: 144, middle: 112, inner: 80, icon: 32 },
  lg: { outer: 180, middle: 140, inner: 100, icon: 40 },
};

export function AnimatedLogo({ size = "md" }: AnimatedLogoProps) {
  const { outer, middle, inner, icon } = sizeConfig[size];

  const outerScale = useSharedValue(1);
  const middleScale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.15);
  const middleOpacity = useSharedValue(0.25);

  useEffect(() => {
    // Outer ring pulse
    outerScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    outerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 0 }),
        withTiming(0.25, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    // Middle ring pulse (delayed)
    middleScale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.06, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );

    middleOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.25, { duration: 0 }),
          withTiming(0.35, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0.25, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: outerOpacity.value,
  }));

  const middleRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: middleScale.value }],
    opacity: middleOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      className="items-center justify-center"
      style={{ width: outer, height: outer }}
    >
      {/* Outer ring */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderWidth: 2,
            borderColor: theme.colors.coral,
          },
          outerRingStyle,
        ]}
      />

      {/* Middle ring */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: middle,
            height: middle,
            borderRadius: middle / 2,
            borderWidth: 2,
            borderColor: theme.colors.gold,
          },
          middleRingStyle,
        ]}
      />

      {/* Inner circle with icon */}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
        }}
        className="bg-white/80 backdrop-blur-xl items-center justify-center shadow-soft border border-white/50"
      >
        <Feather name="mic" size={icon} color={theme.colors.text.primary} />
      </View>
    </Animated.View>
  );
}
