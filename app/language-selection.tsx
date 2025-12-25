import { GradientButton, IconButton, LanguageCard } from "@/components/ui";
import { onboardingStorage } from "@/lib/onboarding";
import { theme } from "@/lib/theme";
import { Language, SUPPORTED_LANGUAGES } from "@/types";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
} from "react-native-reanimated";

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
          if (routerRef.current) {
            routerRef.current.push({
              pathname: "/translate",
              params: {
                languageCode: selectedLanguage.code,
                languageName: selectedLanguage.name,
              },
            });
          }
        } catch (error) {
          console.warn("[LanguageSelection] Navigation error:", error);
        } finally {
          setIsNavigating(false);
        }
      }, 100);
    } catch (error) {
      console.warn("[LanguageSelection] Continue handler error:", error);
      setIsNavigating(false);
    }
  };

  const handleBackPress = async () => {
    if (isNavigating || !routerRef.current) {
      return;
    }
    try {
      // Reset onboarding so user can view it again
      await onboardingStorage.reset();
      routerRef.current.replace("/onboarding");
    } catch (error) {
      console.warn("[LanguageSelection] Back navigation error:", error);
    }
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
