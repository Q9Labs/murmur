import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

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
          withTiming(1.5, { duration: 1200, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      );
      ring1Opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 0 }),
          withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      );

      // Ring 2 - delayed secondary pulse
      ring2Scale.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 0 }),
            withTiming(1.5, { duration: 1200, easing: Easing.out(Easing.ease) })
          ),
          -1,
          false
        )
      );
      ring2Opacity.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 0 }),
            withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) })
          ),
          -1,
          false
        )
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
    buttonScale.value = withSpring(0.92, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulse Ring 1 */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#FF784F',
          },
          ring1Style,
        ]}
      />

      {/* Pulse Ring 2 */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#DB9D47',
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
            width: 80,
            height: 80,
            borderRadius: 40,
            overflow: 'hidden',
            shadowColor: '#FF784F',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isListening ? 0.5 : 0.3,
            shadowRadius: isListening ? 16 : 12,
            elevation: 8,
          }}
        >
          <LinearGradient
            colors={isListening ? ['#FF784F', '#FF5733'] : ['#FF784F', '#DB9D47']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather
              name={isListening ? 'pause' : 'mic'}
              size={32}
              color="#FFFFFF"
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}
