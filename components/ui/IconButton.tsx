import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { theme } from "@/lib/theme";

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  size?: "sm" | "md" | "lg";
  variant?: "glass" | "solid" | "ghost";
  disabled?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = "md",
  variant = "glass",
  disabled = false,
}: IconButtonProps): ReactNode {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (): void => {
    scale.value = withSpring(0.9, theme.spring.default);
  };

  const handlePressOut = (): void => {
    scale.value = withSpring(1, theme.spring.default);
  };

  const iconColor =
    variant === "solid" ? theme.colors.text.light : theme.colors.text.primary;

  const getBackgroundStyle = ():
    | Record<string, string | number>
    | undefined => {
    switch (variant) {
      case "glass":
        return {
          backgroundColor: theme.colors.glass.medium,
          borderWidth: 1,
          borderColor: theme.colors.glass.mediumBorder,
        };
      case "solid":
        return {
          backgroundColor: theme.colors.text.primary,
        };
      case "ghost":
        return {
          backgroundColor: "transparent",
        };
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          {
            width: theme.iconButton.sizes[size].container,
            height: theme.iconButton.sizes[size].container,
            borderRadius: theme.iconButton.borderRadius,
            alignItems: "center",
            justifyContent: "center",
          },
          getBackgroundStyle(),
        ]}
      >
        <Feather
          name={icon}
          size={theme.iconButton.sizes[size].icon}
          color={iconColor}
        />
      </Pressable>
    </Animated.View>
  );
}
