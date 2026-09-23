import { Star } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { formatUiNumber, useUiLocale } from "../../i18n/runtime";
import { ModalSheet } from "../../home/modalSheet";
import { darkMurmurTheme, lightMurmurTheme, type MurmurTheme, useMurmurTheme } from "../../home/theme";
import type { RatingAnswer, RatingStars } from "../screenServices";
import { type UsageSetting, usageChoices } from "./usageChoices";

const starValues: readonly RatingStars[] = [1, 2, 3, 4, 5];

export function RatingSheet(props: {
  initialAnswer?: Partial<RatingAnswer>;
  onClose: () => void;
  onSubmit: (answer: RatingAnswer) => void;
  open: boolean;
}): ReactNode {
  const theme = useMurmurTheme();
  const styles = theme.dark ? darkStyles : lightStyles;
  const { locale, t } = useUiLocale();
  const [stars, setStars] = useState<RatingStars | null>(props.initialAnswer?.stars ?? null);
  const [use, setUse] = useState<UsageSetting | null>(props.initialAnswer?.use ?? null);
  const [otherText, setOtherText] = useState(props.initialAnswer?.otherText ?? "");
  const ready = stars !== null && use !== null;

  return (
    <ModalSheet onClose={props.onClose} open={props.open} scroll title={t("rating.title")}>
      <View accessibilityLabel={t("rating.starsLabel")} accessibilityRole="radiogroup" style={styles.stars}>
        {starValues.map((value) => (
          <Pressable
            accessibilityLabel={t(value === 1 ? "rating.oneStar" : "rating.stars", { count: formatUiNumber(value, locale) })}
            accessibilityRole="radio"
            accessibilityState={{ checked: stars === value }}
            hitSlop={4}
            key={value}
            onPress={() => setStars(value)}
            style={({ pressed }) => [styles.star, pressed && styles.pressed]}
          >
            <Star
              color={stars !== null && value <= stars ? theme.gold : theme.muted}
              fill={stars !== null && value <= stars ? theme.gold : "transparent"}
              size={36}
              strokeWidth={1.75}
            />
          </Pressable>
        ))}
      </View>
      <Text accessibilityRole="header" style={styles.question}>{t("rating.question")}</Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {usageChoices.map((choice) => {
          const selected = use === choice.value;
          const label = t(choice.labelKey);
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={choice.value}
              onPress={() => setUse(selected ? null : choice.value)}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {use === "other" ? (
        <TextInput
          accessibilityLabel={t("rating.otherLabel")}
          maxLength={200}
          onChangeText={setOtherText}
          placeholder={t("rating.otherPlaceholder")}
          placeholderTextColor={theme.muted}
          style={styles.input}
          value={otherText}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={() => stars !== null && use !== null && props.onSubmit({
          otherText: use === "other" && otherText.trim() ? otherText.trim() : null,
          stars,
          use,
        })}
        style={({ pressed }) => [styles.button, !ready && styles.buttonDisabled, pressed && styles.pressed]}
      >
        <Text style={[styles.buttonText, !ready && styles.buttonTextDisabled]}>{t("rating.send")}</Text>
      </Pressable>
    </ModalSheet>
  );
}

function createRatingStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    button: {
      alignItems: "center",
      backgroundColor: theme.action,
      borderRadius: 999,
      justifyContent: "center",
      marginTop: 24,
      minHeight: 56,
      paddingHorizontal: 24,
    },
    buttonDisabled: {
      backgroundColor: theme.input,
    },
    buttonText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
    buttonTextDisabled: {
      color: theme.muted,
    },
    chip: {
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 16,
    },
    chipSelected: {
      backgroundColor: theme.selected,
      borderColor: theme.teal,
    },
    chipText: {
      color: theme.secondaryText,
      fontSize: 15,
      fontWeight: "700",
    },
    chipTextSelected: {
      color: theme.primary,
      fontWeight: "800",
    },
    choices: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    input: {
      backgroundColor: theme.input,
      borderColor: theme.hairline,
      borderRadius: 16,
      borderWidth: 1,
      color: theme.primary,
      fontSize: 17,
      marginTop: 12,
      minHeight: 52,
      paddingHorizontal: 16,
    },
    pressed: {
      opacity: 0.55,
    },
    question: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "800",
      marginBottom: 12,
      marginTop: 28,
    },
    star: {
      alignItems: "center",
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    stars: {
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
      marginTop: 8,
    },
  });
}

const lightStyles = createRatingStyles(lightMurmurTheme);
const darkStyles = createRatingStyles(darkMurmurTheme);
