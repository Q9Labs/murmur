import { Check } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, Text } from "react-native";

import { useUiLocale } from "../../i18n/runtime";
import { uiLocaleNames, uiLocales, type UiLocalePreference } from "../../i18n/types";
import { captureMobileFailure } from "../../lib/observability/sentry";
import { RowGroup } from "../rowGroup";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenStyles } from "../styles";

// The switch is instant in every language: layout direction follows the locale without a reload.
export function LanguageScreen(): ReactNode {
  const { preference, setPreference, t } = useUiLocale();
  const [failed, setFailed] = useState(false);

  function choose(next: UiLocalePreference): void {
    setFailed(false);
    setPreference(next).catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "save_ui_locale", stage: "settings" });
      setFailed(true);
    });
  }

  return (
    <ScreenScaffold title={t("settings.languageTitle")}>
      <RowGroup>
        <LanguageRow
          label={t("settings.systemDefault")}
          onPress={() => choose("system")}
          selected={preference === "system"}
        />
      </RowGroup>
      <RowGroup>
        {uiLocales.map((locale) => (
          <LanguageRow
            key={locale}
            label={uiLocaleNames[locale]}
            lang={locale}
            onPress={() => choose(locale)}
            selected={preference === locale}
          />
        ))}
      </RowGroup>
      <StatusLine error={failed ? t("settings.languageSaveError") : null} notice={null} />
    </ScreenScaffold>
  );
}

function LanguageRow(props: {
  label: string;
  lang?: string;
  onPress: () => void;
  selected: boolean;
}): ReactNode {
  const { colors, styles } = useScreenStyles();
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityLanguage={props.lang}
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.rowLabel}>{props.label}</Text>
      {props.selected ? <Check color={colors.teal} size={22} strokeWidth={2.5} /> : null}
    </Pressable>
  );
}
