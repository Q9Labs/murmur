import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
    <View className="flex-1 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <LinearGradient
        colors={['#faf5ff', '#fce7f3', '#eff6ff']}
        className="flex-1 justify-center items-center px-8"
      >
        <Animated.View
          entering={FadeIn.duration(800)}
          className="items-center"
        >
          {/* Logo/Icon */}
          <View className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full mb-8 items-center justify-center shadow-lg">
            <Text className="text-5xl">🎙️</Text>
          </View>

          {/* Title */}
          <Text className="text-5xl font-bold text-gray-900 mb-4 text-center">
            Murmur
          </Text>

          {/* Subtitle */}
          <Text className="text-lg text-gray-600 text-center mb-16 px-4 leading-relaxed">
            Real-time translation powered by AI
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          className="w-full mb-12 gap-4"
        >
          <FeatureItem
            icon="🌍"
            text="Speak in any language"
            delay={300}
          />
          <FeatureItem
            icon="⚡"
            text="Instant AI translation"
            delay={400}
          />
          <FeatureItem
            icon="✨"
            text="Beautiful, simple interface"
            delay={500}
          />
        </Animated.View>

        {/* CTA Button */}
        <AnimatedPressable
          entering={FadeInDown.delay(600).duration(600).springify()}
          style={buttonAnimatedStyle}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => router.push('/language-selection')}
          className="w-full rounded-2xl overflow-hidden shadow-lg"
        >
          <LinearGradient
            colors={['#a855f7', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="py-5"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Get Started
            </Text>
          </LinearGradient>
        </AnimatedPressable>

        <Animated.Text
          entering={FadeInDown.delay(700).duration(600)}
          className="text-gray-400 text-sm mt-6"
        >
          by Q9Labs
        </Animated.Text>
      </LinearGradient>
    </View>
  );
}

function FeatureItem({ icon, text, delay }: { icon: string; text: string; delay: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(600)}
      className="flex-row items-center bg-white/60 backdrop-blur-sm rounded-xl px-6 py-4 shadow-sm"
    >
      <Text className="text-3xl mr-4">{icon}</Text>
      <Text className="text-gray-700 text-base flex-1">{text}</Text>
    </Animated.View>
  );
}
