import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useState } from 'react';
import { SUPPORTED_LANGUAGES, Language } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function LanguageSelection() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);

  const handleContinue = () => {
    if (selectedLanguage) {
      router.push({
        pathname: '/translate',
        params: { languageCode: selectedLanguage.code, languageName: selectedLanguage.name }
      });
    }
  };

  return (
    <View className="flex-1 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <LinearGradient
        colors={['#faf5ff', '#fce7f3', '#eff6ff']}
        className="flex-1"
      >
        <Animated.View
          entering={FadeIn.duration(400)}
          className="flex-1 pt-16 pb-8 px-6"
        >
          {/* Header */}
          <View className="mb-8">
            <Text className="text-4xl font-bold text-gray-900 mb-2">
              Choose Language
            </Text>
            <Text className="text-base text-gray-600">
              Select the language you want translations in
            </Text>
          </View>

          {/* Language Grid */}
          <ScrollView
            className="flex-1 mb-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View className="gap-3">
              {SUPPORTED_LANGUAGES.map((language, index) => (
                <AnimatedPressable
                  key={language.code}
                  entering={FadeInDown.delay(index * 50).duration(400).springify()}
                  onPress={() => setSelectedLanguage(language)}
                  className={`flex-row items-center justify-between p-5 rounded-2xl shadow-sm active:scale-98 ${
                    selectedLanguage?.code === language.code
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                      : 'bg-white/70 backdrop-blur-sm'
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    <Text className="text-4xl mr-4">{language.flag}</Text>
                    <View>
                      <Text className={`text-lg font-semibold ${
                        selectedLanguage?.code === language.code ? 'text-white' : 'text-gray-900'
                      }`}>
                        {language.name}
                      </Text>
                      <Text className={`text-sm ${
                        selectedLanguage?.code === language.code ? 'text-white/80' : 'text-gray-500'
                      }`}>
                        {language.nativeName}
                      </Text>
                    </View>
                  </View>
                  {selectedLanguage?.code === language.code && (
                    <View className="w-6 h-6 bg-white rounded-full items-center justify-center">
                      <Text className="text-purple-500">✓</Text>
                    </View>
                  )}
                </AnimatedPressable>
              ))}
            </View>
          </ScrollView>

          {/* Continue Button */}
          {selectedLanguage && (
            <AnimatedPressable
              entering={FadeInDown.duration(400).springify()}
              onPress={handleContinue}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl py-5 shadow-lg active:scale-95"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Continue with {selectedLanguage.name}
              </Text>
            </AnimatedPressable>
          )}
        </Animated.View>
      </LinearGradient>
    </View>
  );
}
