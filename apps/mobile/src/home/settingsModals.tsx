import * as Linking from "expo-linking";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { uiContentDirectionStyle, uiTextDirectionStyle, useUiLocale } from "../i18n/runtime";
import { isUiLocale } from "../i18n/types";
import { ModalSheet } from "./modalSheet";
import { useSheetStyles } from "./sheetStyles";
import { AppLanguageList } from "./uiLanguageList";

const legalUrls = {
  privacy: "https://murmur.q9labs.ai/privacy",
  support: "https://murmur.q9labs.ai/support",
  terms: "https://murmur.q9labs.ai/terms",
} as const;

export function SettingsModal(props: {
  developerToolsEnabled: boolean;
  live: LiveTranslationController;
  onClose: () => void;
  onDeleteLocalData: () => void;
  onOpenDiagnostics: () => void;
  onResetIdentity: () => void;
  onShare: () => void;
  open: boolean;
  settingsMessage: string | null;
}): ReactNode {
  const { locale, direction, setLocale, t } = useUiLocale();
  const { colors, styles } = useSheetStyles();
  const [view, setView] = useState<"language" | "settings">("settings");
  const [languageError, setLanguageError] = useState<string | null>(null);
  const disabled = props.live.status === "live";

  useEffect(() => {
    if (!props.open) {
      setView("settings");
      setLanguageError(null);
    }
  }, [props.open]);

  const title = view === "language" ? t("settings.languageTitle") : t("settings.title");
  return (
    <ModalSheet onClose={props.onClose} open={props.open} scroll title={title}>
      {view === "language" ? (
        <AppLanguageList
          direction={direction}
          error={languageError}
          onSaved={() => setView("settings")}
          onSelect={async (id) => {
            if (!isUiLocale(id)) {
              return;
            }
            setLanguageError(null);
            try {
              await setLocale(id);
            } catch (error) {
              setLanguageError(t("settings.languageSaveError"));
              throw error;
            }
          }}
          options={[
            {
              description: t("common.englishDescription"),
              id: "en",
              label: t("common.languageEnglish"),
            },
            {
              description: t("common.arabicDescription"),
              id: "ar",
              label: t("common.languageArabic"),
            },
          ]}
          selectedId={locale}
        />
      ) : (
        <View style={[styles.settingsList, uiContentDirectionStyle(direction)]}>
          <SettingsAction
            direction={direction}
            label={t("settings.appLanguage")}
            onPress={() => setView("language")}
            secondary={locale === "ar" ? t("common.languageArabic") : t("common.languageEnglish")}
          />
        <SettingsAction
          direction={direction}
          disabled={disabled}
          label={t("settings.shareMurmur")}
          onPress={props.onShare}
        />
        <SettingsAction
          direction={direction}
          label={t("settings.privacyPolicy")}
          onPress={() => void Linking.openURL(legalUrls.privacy)}
        />
        <SettingsAction
          direction={direction}
          label={t("settings.termsOfUse")}
          onPress={() => void Linking.openURL(legalUrls.terms)}
        />
        <SettingsAction
          direction={direction}
          label={t("settings.supportDataRequests")}
          onPress={() => void Linking.openURL(legalUrls.support)}
        />
        <SettingsAction
          direction={direction}
          disabled={disabled}
          label={t("settings.deleteLocalData")}
          onPress={props.onDeleteLocalData}
        />
        <SettingsAction
          direction={direction}
          label={props.developerToolsEnabled ? t("settings.sessionDiagnostics") : t("settings.reportTranslation")}
          onPress={props.onOpenDiagnostics}
        />
        <SettingsAction
          direction={direction}
          disabled={disabled}
          label={t("settings.resetMurmurIdentity")}
          onPress={props.onResetIdentity}
        />
        </View>
      )}
      {view === "settings" && props.settingsMessage ? (
        <Text style={[styles.settingsMessage, uiTextDirectionStyle(direction)]}>
          {props.settingsMessage}
        </Text>
      ) : null}
    </ModalSheet>
  );
}

function SettingsAction(props: {
  direction: "ltr" | "rtl";
  disabled?: boolean;
  label: string;
  onPress: () => void;
  secondary?: string;
}): ReactNode {
  const { colors, styles } = useSheetStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.settingsAction,
        uiContentDirectionStyle(props.direction),
        (pressed || props.disabled) && styles.pressed,
      ]}
    >
      <View>
        <Text style={[styles.settingsActionText, uiTextDirectionStyle(props.direction)]}>
          {props.label}
        </Text>
        {props.secondary ? (
          <Text style={[styles.settingsActionMeta, uiTextDirectionStyle(props.direction)]}>
            {props.secondary}
          </Text>
        ) : null}
      </View>
      <ChevronRight
        color={colors.muted}
        size={20}
        strokeWidth={2}
        style={props.direction === "rtl" ? chevronRtl : undefined}
      />
    </Pressable>
  );
}

const chevronRtl = { transform: [{ rotate: "180deg" }] } as const;
