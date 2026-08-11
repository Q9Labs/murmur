import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useSheetStyles } from "./sheetStyles";

export type AppLanguageOption = Readonly<{
  accessibilityLabel?: string;
  description: string;
  id: string;
  label: string;
}>;

export type AppLanguageListProps = Readonly<{
  direction: "ltr" | "rtl";
  error: string | null;
  onSaved?: () => void;
  onSelect: (id: string) => Promise<void>;
  options: readonly AppLanguageOption[];
  selectedId: string;
}>;

export function AppLanguageList({
  direction,
  error,
  onSaved,
  onSelect,
  options,
  selectedId,
}: AppLanguageListProps): ReactNode {
  const { styles } = useSheetStyles();
  const [savingId, setSavingId] = useState<string | null>(null);
  const savingIdRef = useRef<string | null>(null);
  const contentDirection = { direction } as const;
  const textDirection = { writingDirection: direction } as const;

  const selectOption = async (id: string): Promise<void> => {
    if (savingIdRef.current !== null) {
      return;
    }

    savingIdRef.current = id;
    setSavingId(id);
    try {
      await onSelect(id);
      onSaved?.();
    } catch {
      // The parent owns localized save-error copy and keeps this list mounted.
    } finally {
      savingIdRef.current = null;
      setSavingId(null);
    }
  };

  return (
    <View style={[styles.languageList, contentDirection]}>
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        const isSaving = savingId !== null;
        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving, disabled: isSaving, selected: isSelected }}
            disabled={isSaving}
            key={option.id}
            onPress={() => void selectOption(option.id)}
            style={({ pressed }) => [
              styles.languageOption,
              contentDirection,
              isSelected && styles.languageOptionSelected,
              isSaving && styles.languageOptionDisabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.languageOptionCopy, contentDirection]}>
              <Text style={[styles.languageOptionName, textDirection]}>{option.label}</Text>
              <Text style={[styles.languageOptionNative, textDirection]}>{option.description}</Text>
            </View>
            <Text accessibilityElementsHidden style={[styles.languageOptionCheck, textDirection]}>
              {isSelected ? "✓" : ""}
            </Text>
          </Pressable>
        );
      })}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.settingsMessage, textDirection]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
