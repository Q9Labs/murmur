import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

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
  iconColor = '#FF784F',
  highlighted,
  delay = 0,
}: OnboardingSlideProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* Icon Circle */}
      <Animated.View
        entering={FadeIn.duration(500).delay(delay)}
        className="w-24 h-24 rounded-full bg-white/40 items-center justify-center mb-12 border border-white/60 backdrop-blur-sm"
      >
        <Feather name={icon} size={48} color={iconColor} />
      </Animated.View>

      {/* Title */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(delay + 100)}
        className="w-full mb-4"
      >
        <Text className="text-4xl font-bold text-ink text-center tracking-tight">
          {title}
        </Text>
      </Animated.View>

      {/* Description */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(delay + 200)}
        className="w-full"
      >
        <Text className="text-base text-ink-secondary text-center leading-6">
          {description}
          {highlighted && (
            <Text className="font-semibold text-ink">{highlighted}</Text>
          )}
        </Text>
      </Animated.View>
    </View>
  );
}
