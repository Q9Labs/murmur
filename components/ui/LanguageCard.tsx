import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { theme } from "@/lib/theme";
import type { Language } from "@/types";

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
  // Defensive check for language object
  if (!language || typeof language !== "object" || !language.code) {
    return null;
  }

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    try {
      scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
    } catch (error) {
      console.warn("[LanguageCard] PressIn animation error:", error);
    }
  }, [scale]);

  const handlePressOut = useCallback(() => {
    try {
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    } catch (error) {
      console.warn("[LanguageCard] PressOut animation error:", error);
    }
  }, [scale]);

  // Safely handle emoji rendering with fallback
  const flagEmoji = useMemo(() => {
    try {
      // Check if flag is a valid string and contains character
      if (
        language.flag &&
        typeof language.flag === "string" &&
        language.flag.length > 0
      ) {
        return language.flag;
      }
      // Fallback for missing or invalid emoji
      return "🌍";
    } catch (error) {
      console.warn("[LanguageCard] Emoji rendering error:", error);
      return "🌍";
    }
  }, [language.flag]);

  const handlePress = useCallback(() => {
    try {
      onPress();
    } catch (error) {
      console.warn("[LanguageCard] Press handler error:", error);
    }
  }, [onPress]);

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.max(0, index * 50)).duration(400)}
      style={[{ width: "50%", padding: 6 }, animatedStyle]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={false}
        style={{
          position: "relative",
          padding: theme.languageCard.padding,
          borderRadius: theme.languageCard.borderRadius,
          backgroundColor: isSelected
            ? theme.colors.whiteTransparent.intense
            : theme.colors.whiteTransparent.light,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected
            ? theme.colors.coral
            : theme.colors.whiteTransparent.subtle,
        }}
      >
        {/* Selected checkmark badge */}
        {isSelected ? (
          <View
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: theme.colors.coral,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="check" size={14} color={theme.colors.text.light} />
          </View>
        ) : null}

        {/* Flag container with emoji fallback */}
        <View
          style={{
            width: theme.languageCard.flagContainer.size,
            height: theme.languageCard.flagContainer.size,
            borderRadius: theme.languageCard.flagContainer.borderRadius,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            backgroundColor: isSelected
              ? theme.colors.coralMuted
              : theme.colors.goldMuted,
          }}
        >
          <Text
            style={{ fontSize: theme.languageCard.flagContainer.fontSize }}
            allowFontScaling={false}
            maxFontSizeMultiplier={1}
          >
            {flagEmoji}
          </Text>
        </View>

        {/* Language name */}
        <Text
          style={{
            fontSize: theme.languageCard.nameTextSize,
            fontWeight: "600",
            color: isSelected
              ? theme.colors.text.primary
              : theme.colors.text.secondary,
          }}
          allowFontScaling={true}
          maxFontSizeMultiplier={1.3}
        >
          {language.name && typeof language.name === "string"
            ? language.name
            : "Unknown"}
        </Text>

        {/* Native name */}
        <Text
          style={{
            fontSize: theme.languageCard.nativeNameTextSize,
            marginTop: 2,
            color: isSelected
              ? theme.colors.text.secondary
              : theme.colors.text.muted,
          }}
          allowFontScaling={true}
          maxFontSizeMultiplier={1.3}
        >
          {language.nativeName && typeof language.nativeName === "string"
            ? language.nativeName
            : ""}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
