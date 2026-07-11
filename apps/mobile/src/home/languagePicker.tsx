import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  autoSourceLanguageCode,
  languageRegistry,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import { ModalSheet } from "./modalSheet";
import { styles } from "./styles";
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
  return (
    <LanguagePickerModal
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
  mode,
  onClose,
  onSelect,
  selected,
}: {
  disabledLanguage?: LanguageCode;
  mode: PickerMode;
  onClose: () => void;
  onSelect: (language: SourceLanguageCode) => void;
  selected: SourceLanguageCode;
}): ReactNode {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLanguages = languageRegistry.filter((language) => {
    const haystack = `${language.display_name} ${language.native_name} ${language.openrouter_label}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  const showAutoDetect =
    mode === "source" && `auto detect automatic source language`.includes(normalizedQuery);

  useEffect(() => {
    if (mode) {
      setQuery("");
    }
  }, [mode]);

  return (
    <ModalSheet onClose={onClose} open={mode !== null} title={mode === "source" ? "I will speak" : "Translate into"}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setQuery}
        placeholder="Search languages"
        placeholderTextColor="#8E8A82"
        style={styles.searchInput}
        value={query}
      />
      <ScrollView contentContainerStyle={styles.languageList}>
        <AutoDetectOption onSelect={onSelect} selected={selected} visible={showAutoDetect} />
        {filteredLanguages.map((language) => {
          const isSelected = language.app_code === selected;
          const isDisabled = language.app_code === disabledLanguage;
          return (
            <Pressable
              accessibilityRole="button"
              disabled={isDisabled}
              key={language.app_code}
              onPress={() => onSelect(language.app_code)}
              style={({ pressed }) => [
                styles.languageOption,
                isSelected && styles.languageOptionSelected,
                (pressed || isDisabled) && styles.pressed,
              ]}
            >
              <View>
                <Text style={styles.languageOptionName}>{language.display_name}</Text>
                <Text style={styles.languageOptionNative}>{language.native_name}</Text>
              </View>
              <Text style={styles.languageOptionCheck}>{isSelected ? "Selected" : ""}</Text>
            </Pressable>
          );
        })}
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
  if (!visible) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(autoSourceLanguageCode)}
      style={({ pressed }) => [
        styles.languageOption,
        selected === autoSourceLanguageCode && styles.languageOptionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <Text style={styles.languageOptionName}>Auto detect</Text>
        <Text style={styles.languageOptionNative}>Live multilingual source</Text>
      </View>
      <Text style={styles.languageOptionCheck}>
        {selected === autoSourceLanguageCode ? "Selected" : ""}
      </Text>
    </Pressable>
  );
}
