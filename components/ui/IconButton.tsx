import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'glass' | 'solid' | 'ghost';
  disabled?: boolean;
}

const sizeConfig = {
  sm: { container: 36, icon: 18 },
  md: { container: 44, icon: 22 },
  lg: { container: 56, icon: 26 },
};

export function IconButton({
  icon,
  onPress,
  size = 'md',
  variant = 'glass',
  disabled = false,
}: IconButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
  };

  const iconColor = variant === 'solid' ? '#FFFFFF' : '#3A3042';

  const getBackgroundStyle = () => {
    switch (variant) {
      case 'glass':
        return {
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.4)',
        };
      case 'solid':
        return {
          backgroundColor: '#3A3042',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
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
            width: sizeConfig[size].container,
            height: sizeConfig[size].container,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          },
          getBackgroundStyle(),
        ]}
      >
        <Feather name={icon} size={sizeConfig[size].icon} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
}
