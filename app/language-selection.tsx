import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GradientButton, IconButton, LanguageCard } from "@/components/ui";
import { theme } from "@/lib/theme";
import { type Language, SUPPORTED_LANGUAGES } from "@/types";

function LanguageSelectionContent() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    null,
  );

  const handleContinue = () => {
    if (!selectedLanguage) return;
    router.push({
      pathname: "/translate",
      params: {
        languageCode: selectedLanguage.code,
        languageName: selectedLanguage.name,
      },
    });
  };

  const handleBackPress = () => {
    router.back();
  };

  return (
    <LinearGradient
      colors={theme.gradients.background.colors as [string, string, string]}
      locations={theme.gradients.background.locations}
      start={theme.gradients.background.start}
      end={theme.gradients.background.end}
      style={{ flex: 1 }}
    >
      <View className="flex-1 pt-14 pb-6">
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)} className="px-6 mb-6">
          <IconButton
            icon="arrow-left"
            onPress={handleBackPress}
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
          scrollEnabled={true}
          nestedScrollEnabled={true}
        >
          <View className="flex-row flex-wrap">
            {SUPPORTED_LANGUAGES && SUPPORTED_LANGUAGES.length > 0
              ? SUPPORTED_LANGUAGES.map((language, index) => {
                  // Defensive check for language object
                  if (!language || !language.code) {
                    return null;
                  }
                  return (
                    <LanguageCard
                      key={`language-${language.code}`}
                      language={language}
                      isSelected={selectedLanguage?.code === language.code}
                      onPress={() => setSelectedLanguage(language)}
                      index={index}
                    />
                  );
                })
              : null}
          </View>
        </ScrollView>

        {/* Continue Button - Fixed at bottom */}
        {selectedLanguage ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-4"
          >
            <LinearGradient
              colors={theme.gradients.overlay.buttonFade.colors}
              locations={theme.gradients.overlay.buttonFade.locations}
              start={theme.gradients.overlay.buttonFade.start}
              end={theme.gradients.overlay.buttonFade.end}
              className="absolute inset-0"
            />
            <GradientButton
              title="Continue"
              icon="arrow-right"
              onPress={handleContinue}
            />
          </Animated.View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export default function LanguageSelection(): ReactNode {
  return (
    <ErrorBoundary
      allowNavigateHome={true}
      onError={(error) => {
        console.error("[LanguageSelection] ErrorBoundary caught error:", error);
      }}
    >
      <LanguageSelectionContent />
    </ErrorBoundary>
  );
}
