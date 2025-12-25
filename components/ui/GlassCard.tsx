import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "@/lib/theme";

interface GlassCardProps extends ViewProps {
  children: ReactNode;
  variant?: "default" | "accent";
  animated?: boolean;
  delay?: number;
}

export function GlassCard({
  children,
  variant = "default",
  animated = false,
  delay = 0,
  className = "",
  style,
  ...props
}: GlassCardProps): ReactNode {
  const baseClasses = "rounded-3xl backdrop-blur-md border";

  const variantStyles = {
    default: {
      backgroundColor: theme.colors.glass.default,
      borderColor: theme.colors.glass.defaultBorder,
    },
    accent: {
      backgroundColor: theme.colors.coralAccent,
      borderColor: theme.colors.coralBorder,
    },
  };

  const combinedStyle = {
    borderWidth: 1,
    ...variantStyles[variant],
    ...(style as object),
  };

  if (animated) {
    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(delay)}
        className={baseClasses + (className ? ` ${className}` : "")}
        style={combinedStyle}
        {...props}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <View
      className={baseClasses + (className ? ` ${className}` : "")}
      style={combinedStyle}
      {...props}
    >
      {children}
    </View>
  );
}
