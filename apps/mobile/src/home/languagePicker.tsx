import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  autoSourceLanguageCode,
  languageRegistry,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import { useMurmurBilling } from "../lib/billing/context";
import { isLanguageEnabled } from "./languageAvailability";
import { uiTextDirectionStyle, useUiLocale } from "../i18n/runtime";
import { ModalSheet } from "./modalSheet";
import { useSheetStyles } from "./sheetStyles";
import type { PickerMode } from "./types";

type LanguagePickerControllerProps = {
  mode: PickerMode;
  onClose: () => void;
  setSourceLanguageCode: (language: SourceLanguageCode) => void;
  setTargetLanguageCode: (language: LanguageCode) => void;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
};

export function LanguagePickerController({
  mode,
  onClose,
  setSourceLanguageCode,
  setTargetLanguageCode,
  sourceLanguageCode,
  targetLanguageCode,
}: LanguagePickerControllerProps): ReactNode {
  const { enabledLanguages } = useMurmurBilling().config;
  return (
    <LanguagePickerModal
      enabledLanguages={enabledLanguages}
      disabledLanguage={getDisabledLanguage({ mode, sourceLanguageCode, targetLanguageCode })}
      mode={mode}
      onClose={onClose}
      onSelect={(language) => {
        if (mode === "source") {
          setSourceLanguageCode(language);
        } else {
          setTargetLanguageCode(language === autoSourceLanguageCode ? targetLanguageCode : language);
        }
        onClose();
      }}
      selected={mode === "source" ? sourceLanguageCode : targetLanguageCode}
    />
  );
}

function getDisabledLanguage(params: {
  mode: PickerMode;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
}): LanguageCode | undefined {
  if (params.mode === "source") {
    return params.targetLanguageCode;
  }
  return params.sourceLanguageCode === autoSourceLanguageCode ? undefined : params.sourceLanguageCode;
}

function LanguagePickerModal({
  disabledLanguage,
  enabledLanguages,
  mode,
  onClose,
  onSelect,
  selected,
}: {
  disabledLanguage?: LanguageCode;
  enabledLanguages: readonly LanguageCode[] | null;
  mode: PickerMode;
  onClose: () => void;
  onSelect: (language: SourceLanguageCode) => void;
  selected: SourceLanguageCode;
}): ReactNode {
  const { colors, styles } = useSheetStyles();
  const { direction, t } = useUiLocale();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLanguages = languageRegistry.filter((language) => {
    if (!isLanguageEnabled(language.app_code, enabledLanguages)) {
      return false;
    }
    const haystack = `${language.display_name} ${language.native_name}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  const showAutoDetect = mode === "source" && [
    t("languagePicker.autoDetect"),
    t("languagePicker.liveMultilingualSource"),
  ].join(" ").toLowerCase().includes(normalizedQuery);

  useEffect(() => {
    if (mode) {
      setQuery("");
    }
  }, [mode]);

  return (
    <ModalSheet
      onClose={onClose}
      open={mode !== null}
      title={mode === "source" ? t("languagePicker.speakIn") : t("languagePicker.translateTo")}
    >
      <TextInput
        accessibilityLabel={t("accessibility.searchLanguages")}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={setQuery}
        placeholder={t("languagePicker.search")}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={[styles.searchInput, uiTextDirectionStyle(direction)]}
        value={query}
      />
      <ScrollView
        contentContainerStyle={styles.languageList}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.languageListScroll}
      >
        <AutoDetectOption onSelect={onSelect} selected={selected} visible={showAutoDetect} />
        {filteredLanguages.length === 0 && !showAutoDetect ? (
          <Text accessibilityRole="text" style={styles.languageEmpty}>
            {t("languagePicker.noResults")}
          </Text>
        ) : (
          filteredLanguages.map((language) => {
            const isSelected = language.app_code === selected;
            const isDisabled = language.app_code === disabledLanguage;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                disabled={isDisabled}
                key={language.app_code}
                onPress={() => onSelect(language.app_code)}
                style={({ pressed }) => [
                  styles.languageOption,
                  isSelected && styles.languageOptionSelected,
                  isDisabled && styles.languageOptionDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.languageOptionCopy}>
                  <Text
                    style={[
                      styles.languageOptionName,
                      isSelected && styles.languageOptionNameSelected,
                      uiTextDirectionStyle(direction),
                    ]}
                  >
                    {language.display_name}
                  </Text>
                  <Text
                    style={[
                      styles.languageOptionNative,
                      isSelected && styles.languageOptionNativeSelected,
                      uiTextDirectionStyle(direction),
                      { writingDirection: language.rtl ? "rtl" : "ltr" },
                    ]}
                  >
                    {language.native_name}
                  </Text>
                </View>
                <Text
                  accessibilityElementsHidden
                  style={[styles.languageOptionCheck, isSelected && styles.languageOptionCheckSelected]}
                >
                  {isSelected ? "✓" : ""}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ModalSheet>
  );
}

function AutoDetectOption({
  onSelect,
  selected,
  visible,
}: {
  onSelect: (language: SourceLanguageCode) => void;
  selected: SourceLanguageCode;
  visible: boolean;
}): ReactNode {
  const { styles } = useSheetStyles();
  const { direction, t } = useUiLocale();
  if (!visible) {
    return null;
  }
  const isSelected = selected === autoSourceLanguageCode;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(autoSourceLanguageCode)}
      style={({ pressed }) => [
        styles.languageOption,
        isSelected && styles.languageOptionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.languageOptionCopy}>
        <Text
          style={[
            styles.languageOptionName,
            isSelected && styles.languageOptionNameSelected,
            uiTextDirectionStyle(direction),
          ]}
        >
          {t("languagePicker.autoDetect")}
        </Text>
        <Text
          style={[
            styles.languageOptionNative,
            isSelected && styles.languageOptionNativeSelected,
            uiTextDirectionStyle(direction),
          ]}
        >
          {t("languagePicker.liveMultilingualSource")}
        </Text>
      </View>
      <Text
        accessibilityElementsHidden
        style={[styles.languageOptionCheck, isSelected && styles.languageOptionCheckSelected]}
      >
        {isSelected ? "✓" : ""}
      </Text>
    </Pressable>
  );
}
