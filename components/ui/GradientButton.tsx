import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  animated?: boolean;
  delay?: number;
}

export function GradientButton({
  title,
  onPress,
  icon = 'arrow-right',
  loading = false,
  disabled = false,
  variant = 'primary',
  animated = false,
  delay = 0,
}: GradientButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
  };

  const gradientColors =
    variant === 'primary'
      ? ['#FF784F', '#DB9D47'] as const
      : ['#FFFFFF', '#FFF8F0'] as const;

  const textColor = variant === 'primary' ? '#FFFFFF' : '#3A3042';
  const iconColor = variant === 'primary' ? '#FFFFFF' : '#3A3042';

  const content = (
    <Animated.View style={[animatedStyle, { width: '100%' }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={{
          width: '100%',
          borderRadius: 16,
          overflow: 'hidden',
          shadowColor: '#FF784F',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 18,
            paddingHorizontal: 24,
          }}
        >
          {loading ? (
            <ActivityIndicator color={iconColor} />
          ) : (
            <>
              <Text style={{ fontSize: 18, fontWeight: '600', color: textColor, marginRight: 8 }}>
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
