import React from 'react';
import { View, ViewProps } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent';
  animated?: boolean;
  delay?: number;
}

export function GlassCard({
  children,
  variant = 'default',
  animated = false,
  delay = 0,
  className = '',
  ...props
}: GlassCardProps) {
  const baseClasses = 'rounded-3xl backdrop-blur-md border';

  const variantClasses = {
    default: 'bg-white/70 border-white/40',
    accent: 'bg-coral/5 border-coral/10',
  };

  const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (animated) {
    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(delay)}
        className={combinedClassName}
        {...props}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <View className={combinedClassName} {...props}>
      {children}
    </View>
  );
}
