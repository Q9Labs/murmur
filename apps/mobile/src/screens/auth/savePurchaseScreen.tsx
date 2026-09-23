import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { useUiLocale } from "../../i18n/runtime";
import { useMurmurBilling } from "../../lib/billing/context";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenStyles } from "../styles";
import { EmailSignInButton, SocialSignInButtons } from "./socialButtons";
import { useAuthStyles } from "./styles";

export function SavePurchaseScreen(): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { t } = useUiLocale();
  const { colors, styles } = useAuthStyles();
  const screen = useScreenStyles().styles;
  const [error, setError] = useState<string | null>(null);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (billing.customer?.isRegistered) {
    return (
      <ScreenScaffold footer={<PrimaryAction label={t("auth.done")} onPress={leave} />} title={t("savePurchase.savedTitle")}>
        <View accessibilityElementsHidden importantForAccessibility="no" style={styles.doneBadge}>
          <Check color={colors.teal} size={30} strokeWidth={2.5} />
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.body, styles.centered]}>
          {t("savePurchase.savedBody")}
        </Text>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      footer={<QuietAction label={t("savePurchase.notNow")} onPress={leave} />}
      title={t("savePurchase.title")}
    >
      <Text style={screen.body}>{t("savePurchase.body")}</Text>
      <View style={styles.flow}>
        <SocialSignInButtons disabled={billing.busy} onError={setError} />
        <EmailSignInButton disabled={billing.busy} label={t("auth.continueEmail")} onPress={() => router.replace("/sign-in")} />
      </View>
      <StatusLine error={error} notice={null} />
    </ScreenScaffold>
  );
}
