import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, withSpring, useSharedValue, withRepeat, withSequence } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

export default function Onboarding() {
  const router = useRouter();
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  return (
    <LinearGradient
      colors={['#DCD6F7', '#D0F4DE', '#A9DEF9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}
    >
        <Animated.View
          entering={FadeIn.duration(800)}
          className="items-center"
        >
          {/* Logo/Icon */}
          <View className="w-32 h-32 bg-white/40 rounded-full mb-8 items-center justify-center shadow-sm backdrop-blur-md border border-white/50">
            <Feather name="mic" size={48} color="#4A4E69" />
          </View>

          {/* Title */}
          <Text className="text-5xl font-bold text-pastel-text mb-2 text-center tracking-tight">
            Murmur
          </Text>

          {/* Subtitle */}
          <Text className="text-lg text-pastel-text-light text-center mb-16 px-4 leading-relaxed font-medium">
            Seamless AI Translation
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          className="w-full mb-16 gap-4"
        >
          <FeatureItem
            icon="globe"
            text="Universal Language Support"
            delay={300}
            color="#A9DEF9"
          />
          <FeatureItem
            icon="zap"
            text="Instant Real-time Translation"
            delay={400}
            color="#FFC4D6"
          />
          <FeatureItem
            icon="smile"
            text="Simple & Beautiful Design"
            delay={500}
            color="#FCF6BD"
          />
        </Animated.View>

        {/* CTA Button */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(600).springify()}
          className="w-full"
        >
          <Animated.View style={buttonAnimatedStyle}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={() => router.push('/language-selection')}
              className="w-full rounded-3xl overflow-hidden shadow-lg shadow-pastel-purple/50"
            >
              <LinearGradient
                colors={['#4A4E69', '#2D2F40']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-5"
              >
                <Text className="text-white text-center text-lg font-bold tracking-wide">
                  Get Started
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(700).duration(600)}
          className="text-pastel-text-light/60 text-xs mt-8 font-medium"
        >
          Designed for connection
        </Animated.Text>
    </LinearGradient>
  );
}

function FeatureItem({ icon, text, delay, color }: { icon: keyof typeof Feather.glyphMap; text: string; delay: number; color: string }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(600)}
      className="flex-row items-center bg-white/70 backdrop-blur-md rounded-2xl px-5 py-4 shadow-sm border border-white/40"
    >
      <View className="w-10 h-10 rounded-full items-center justify-center mr-4" style={{ backgroundColor: color }}>
        <Feather name={icon} size={20} color="#4A4E69" />
      </View>
      <Text className="text-pastel-text text-base font-medium flex-1">{text}</Text>
    </Animated.View>
  );
}