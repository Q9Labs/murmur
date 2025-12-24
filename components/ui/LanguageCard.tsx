import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import { Language } from '@/types';

interface LanguageCardProps {
  language: Language;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}

export function LanguageCard({
  language,
  isSelected,
  onPress,
  index,
}: LanguageCardProps) {
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

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(400)}
      style={[{ width: '50%', padding: 6 }, animatedStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          position: 'relative',
          padding: 16,
          borderRadius: 16,
          backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? '#FF784F' : 'rgba(255,255,255,0.4)',
        }}
      >
        {/* Selected checkmark badge */}
        {isSelected && (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#FF784F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check" size={14} color="#FFFFFF" />
          </View>
        )}

        {/* Flag container */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            backgroundColor: isSelected ? 'rgba(255,120,79,0.15)' : 'rgba(255,225,156,0.3)',
          }}
        >
          <Text style={{ fontSize: 24 }}>{language.flag}</Text>
        </View>

        {/* Language name */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: isSelected ? '#3A3042' : '#5A4A62',
          }}
        >
          {language.name}
        </Text>

        {/* Native name */}
        <Text
          style={{
            fontSize: 14,
            marginTop: 2,
            color: isSelected ? '#5A4A62' : '#8A7A92',
          }}
        >
          {language.nativeName}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
