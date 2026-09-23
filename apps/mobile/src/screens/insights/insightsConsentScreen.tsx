import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { ScreenScaffold, SecondaryAction, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";

// Asked once, after the first completed session. Nothing is pre-selected and both
// answers carry the same weight.
export function InsightsConsentScreen(): ReactNode {
  const router = useRouter();
  const services = useScreenServices();
  const { styles } = useScreenStyles();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (consent: boolean) => {
    setSaving(true);
    setError(null);
    services.setInsightsConsent(consent)
      .then(() => (router.canGoBack() ? router.back() : router.replace("/")))
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "Your choice wasn't saved. Try again.");
      })
      .finally(() => setSaving(false));
  };

  return (
    <ScreenScaffold
      footer={(
        <View style={styles.choiceRow}>
          <View style={styles.choice}>
            <SecondaryAction disabled={saving} label="Yes" onPress={() => choose(true)} />
          </View>
          <View style={styles.choice}>
            <SecondaryAction disabled={saving} label="No" onPress={() => choose(false)} />
          </View>
        </View>
      )}
      title="Help improve Murmur?"
    >
      <Text style={styles.body}>
        After a session, a third-party AI service can read the translation and write a short summary, like its
        topic. We keep the summary, never the translation.
      </Text>
      <Text style={styles.body}>You can change this anytime in Settings.</Text>
      <StatusLine error={error} notice={null} />
    </ScreenScaffold>
  );
}
