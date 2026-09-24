import { useRouter } from "expo-router";
import { Settings, ShieldCheck, Sparkles } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Text } from "react-native";

import { sessionInsightsIllustration } from "../../home/illustrations";
import type { MessageKey } from "../../i18n/catalogs/en";
import { failureCopy } from "../../i18n/localizedError";
import { useUiLocale } from "../../i18n/runtime";
import { type HeroPoint, HeroPoints } from "../heroPoints";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";

// Asked once, after the first completed session. Yes leads as the primary action because
// we want the help, but this consent sends translations to a third-party AI, so it must
// stay freely given: nothing is pre-selected, No is always visible, readable and just as
// easy to tap, and the points below state plainly what happens either way.
const disclosurePoints: ReadonlyArray<{ icon: HeroPoint["icon"]; text: MessageKey }> = [
  { icon: Sparkles, text: "insights.summary" },
  { icon: ShieldCheck, text: "insights.kept" },
  { icon: Settings, text: "insights.changeLater" },
];

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
      artwork={sessionInsightsIllustration}
      footer={(
        <>
          <StatusLine error={error} notice={null} />
          <PrimaryAction disabled={saving} label={t("insights.yes")} onPress={() => choose(true)} />
          <QuietAction disabled={saving} label={t("insights.no")} onPress={() => choose(false)} />
        </>
      )}
      title={t("insights.title")}
    >
      <Text style={styles.heroLead}>{t("insights.lead")}</Text>
      <HeroPoints points={disclosurePoints.map((point) => ({ icon: point.icon, text: t(point.text) }))} />
    </ScreenScaffold>
  );
}
