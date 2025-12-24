import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SUPPORTED_LANGUAGES, Language } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { IconButton, LanguageCard, GradientButton } from '@/components/ui';

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
    <LinearGradient
      colors={['#FFFBF7', '#FFE19C', '#EDFFD9']}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View className="flex-1 pt-14 pb-6">
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="px-6 mb-6"
        >
          <IconButton
            icon="arrow-left"
            onPress={() => router.back()}
            size="md"
            variant="glass"
          />

          <Text className="text-3xl font-bold text-ink mt-5 tracking-tight">
            Select Language
          </Text>
          <Text className="text-base text-ink-secondary mt-1">
            Which language would you like to translate to?
          </Text>
        </Animated.View>

        {/* Language Grid */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}
        >
          <View className="flex-row flex-wrap">
            {SUPPORTED_LANGUAGES.map((language, index) => (
              <LanguageCard
                key={language.code}
                language={language}
                isSelected={selectedLanguage?.code === language.code}
                onPress={() => setSelectedLanguage(language)}
                index={index}
              />
            ))}
          </View>
        </ScrollView>

        {/* Continue Button - Fixed at bottom */}
        {selectedLanguage && (
          <Animated.View
            entering={SlideInDown.duration(300).springify()}
            className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4"
          >
            <LinearGradient
              colors={['transparent', '#FFFBF7']}
              locations={[0, 0.3]}
              className="absolute inset-0"
            />
            <GradientButton
              title="Continue"
              icon="arrow-right"
              onPress={handleContinue}
            />
          </Animated.View>
        )}
      </View>
    </LinearGradient>
  );
}
