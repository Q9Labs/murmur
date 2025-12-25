import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { SUPPORTED_LANGUAGES, Language } from "@/types";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
} from "react-native-reanimated";
import { IconButton, LanguageCard, GradientButton } from "@/components/ui";

export default function LanguageSelection() {
  const router = useRouter();
  const routerRef = useRef(router);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    null,
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Update router ref when it changes
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const handleContinue = () => {
    // Prevent multiple navigation attempts
    if (isNavigating || !selectedLanguage || !routerRef.current) {
      return;
    }

    try {
      setIsNavigating(true);

      // Debounce navigation to prevent multiple rapid pushes
      navigationTimeoutRef.current = setTimeout(() => {
        try {
          routerRef.current.push({
            pathname: "/translate",
            params: {
              languageCode: selectedLanguage.code,
              languageName: selectedLanguage.name,
            },
          });
        } catch (error) {
          console.warn("[LanguageSelection] Navigation error:", error);
          setIsNavigating(false);
        }
      }, 100);
    } catch (error) {
      console.warn("[LanguageSelection] Continue handler error:", error);
      setIsNavigating(false);
    }
  };

  const handleBackPress = () => {
    if (isNavigating || !routerRef.current) {
      return;
    }
    try {
      routerRef.current.back();
    } catch (error) {
      console.warn("[LanguageSelection] Back navigation error:", error);
    }
  };

  return (
    <LinearGradient
      colors={["#FFFBF7", "#FFE19C", "#EDFFD9"]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
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
                      onPress={() => {
                        try {
                          setSelectedLanguage(language);
                        } catch (error) {
                          console.warn(
                            "[LanguageSelection] Selection error:",
                            error,
                          );
                        }
                      }}
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
              colors={["transparent", "#FFFBF7"]}
              locations={[0, 0.3]}
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
