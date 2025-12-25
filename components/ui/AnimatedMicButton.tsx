import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { theme } from "@/lib/theme";

interface AnimatedMicButtonProps {
  isListening: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function AnimatedMicButton({
  isListening,
  onPress,
  disabled = false,
}: AnimatedMicButtonProps) {
  const buttonScale = useSharedValue(1);
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0);

  // Pulse animation when listening
  useEffect(() => {
    if (isListening) {
      // Ring 1 - primary pulse
      ring1Scale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.5, { duration: 1200, easing: Easing.out(Easing.ease) }),
        ),
        -1,
        false,
      );
      ring1Opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 0 }),
          withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) }),
        ),
        -1,
        false,
      );

      // Ring 2 - delayed secondary pulse
      ring2Scale.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 0 }),
            withTiming(1.5, {
              duration: 1200,
              easing: Easing.out(Easing.ease),
            }),
          ),
          -1,
          false,
        ),
      );
      ring2Opacity.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 0 }),
            withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
    } else {
      // Stop animations
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);

      ring1Scale.value = withTiming(1, { duration: 200 });
      ring1Opacity.value = withTiming(0, { duration: 200 });
      ring2Scale.value = withTiming(1, { duration: 200 });
      ring2Opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isListening]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.92, theme.spring.default);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, theme.spring.default);
  };

  return (
    <View
      style={{
        width: theme.micButton.container.width * 1.5,
        height: theme.micButton.container.height * 1.5,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Pulse Ring 1 */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: theme.micButton.ring.size,
            height: theme.micButton.ring.size,
            borderRadius: theme.micButton.ring.borderRadius,
            backgroundColor: theme.colors.coral,
          },
          ring1Style,
        ]}
      />

      {/* Pulse Ring 2 */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: theme.micButton.ring.size,
            height: theme.micButton.ring.size,
            borderRadius: theme.micButton.ring.borderRadius,
            backgroundColor: theme.colors.gold,
          },
          ring2Style,
        ]}
      />

      {/* Main Button */}
      <Animated.View style={buttonAnimatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={{
            width: theme.micButton.container.width,
            height: theme.micButton.container.height,
            borderRadius: theme.micButton.container.borderRadius,
            overflow: "hidden",
            shadowColor: theme.colors.coral,
            shadowOffset: isListening
              ? theme.shadow.microphone.active.shadowOffset
              : theme.shadow.microphone.idle.shadowOffset,
            shadowOpacity: isListening
              ? theme.shadow.microphone.active.shadowOpacity
              : theme.shadow.microphone.idle.shadowOpacity,
            shadowRadius: isListening
              ? theme.shadow.microphone.active.shadowRadius
              : theme.shadow.microphone.idle.shadowRadius,
            elevation: theme.shadow.microphone.idle.elevation,
          }}
        >
          <LinearGradient
            colors={
              isListening
                ? theme.gradients.button.microphone.active
                : theme.gradients.button.microphone.idle
            }
            start={theme.gradients.button.microphone.start}
            end={theme.gradients.button.microphone.end}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name={isListening ? "pause" : "mic"}
              size={theme.micButton.icon}
              color={theme.colors.text.light}
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}
