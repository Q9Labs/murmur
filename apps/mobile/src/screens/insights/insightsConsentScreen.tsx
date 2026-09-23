import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { failureCopy } from "../../i18n/localizedError";
import { useUiLocale } from "../../i18n/runtime";
import { ScreenScaffold, SecondaryAction, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";

// Asked once, after the first completed session. Nothing is pre-selected and both
// answers carry the same weight.
export function InsightsConsentScreen(): ReactNode {
  const router = useRouter();
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const ui = useUiLocale();
  const { t } = ui;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (consent: boolean) => {
    setSaving(true);
    setError(null);
    services.setInsightsConsent(consent)
      .then(() => (router.canGoBack() ? router.back() : router.replace("/")))
      .catch((failure: unknown) => {
        setError(failureCopy(failure, ui, "insights.saveFailed"));
      })
      .finally(() => setSaving(false));
  };

  return (
    <ScreenScaffold
      footer={(
        <View style={styles.choiceRow}>
          <View style={styles.choice}>
            <SecondaryAction disabled={saving} label={t("insights.yes")} onPress={() => choose(true)} />
          </View>
          <View style={styles.choice}>
            <SecondaryAction disabled={saving} label={t("insights.no")} onPress={() => choose(false)} />
          </View>
        </View>
      )}
      title={t("insights.title")}
    >
      <Text style={styles.body}>{t("insights.body")}</Text>
      <Text style={styles.body}>{t("insights.changeLater")}</Text>
      <StatusLine error={error} notice={null} />
    </ScreenScaffold>
  );
}
