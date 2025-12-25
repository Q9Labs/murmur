import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { theme } from "@/lib/theme";

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  animated?: boolean;
  delay?: number;
}

export function GradientButton({
  title,
  onPress,
  icon = "arrow-right",
  loading = false,
  disabled = false,
  variant = "primary",
  animated = false,
  delay = 0,
}: GradientButtonProps): ReactNode {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, theme.spring.default);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, theme.spring.default);
  };

  const gradientColors =
    variant === "primary"
      ? theme.gradients.button.primary.colors
      : theme.gradients.button.secondary.colors;

  const textColor =
    variant === "primary" ? theme.colors.text.light : theme.colors.text.primary;
  const iconColor =
    variant === "primary" ? theme.colors.text.light : theme.colors.text.primary;

  const content = (
    <Animated.View style={[animatedStyle, { width: "100%" }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={{
          width: "100%",
          borderRadius: theme.borderRadius.lg,
          overflow: "hidden",
          shadowColor: theme.colors.coral,
          shadowOffset: theme.shadow.default.shadowOffset,
          shadowOpacity: theme.shadow.default.shadowOpacity,
          shadowRadius: theme.shadow.default.shadowRadius,
          elevation: theme.shadow.default.elevation,
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={theme.gradients.button.primary.start}
          end={theme.gradients.button.primary.end}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 18,
            paddingHorizontal: 24,
          }}
        >
          {loading ? (
            <ActivityIndicator color={iconColor} />
          ) : (
            <>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: "600",
                  color: textColor,
                  marginRight: 8,
                }}
              >
                {title}
              </Text>
              <Feather name={icon} size={20} color={iconColor} />
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );

  if (animated) {
    return (
      <Animated.View entering={FadeInDown.springify().delay(delay)}>
        {content}
      </Animated.View>
    );
  }

  return content;
}
