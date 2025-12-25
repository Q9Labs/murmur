import React, { useCallback, useMemo } from "react";
import { Text, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from "react-native-reanimated";
import { Language } from "@/types";

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
          padding: 16,
          borderRadius: 16,
          backgroundColor: isSelected
            ? "rgba(255,255,255,0.8)"
            : "rgba(255,255,255,0.5)",
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? "#FF784F" : "rgba(255,255,255,0.4)",
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
              backgroundColor: "#FF784F",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="check" size={14} color="#FFFFFF" />
          </View>
        ) : null}

        {/* Flag container with emoji fallback */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            backgroundColor: isSelected
              ? "rgba(255,120,79,0.15)"
              : "rgba(255,225,156,0.3)",
          }}
        >
          <Text
            style={{ fontSize: 24 }}
            allowFontScaling={false}
            maxFontSizeMultiplier={1}
          >
            {flagEmoji}
          </Text>
        </View>

        {/* Language name */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: isSelected ? "#3A3042" : "#5A4A62",
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
            fontSize: 14,
            marginTop: 2,
            color: isSelected ? "#5A4A62" : "#8A7A92",
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
