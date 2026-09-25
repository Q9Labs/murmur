import { useRouter } from "expo-router";
import { Clock, KeyRound } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo } from "react-native";

import { savePurchaseIllustration } from "../../home/illustrations";
import { useUiLocale } from "../../i18n/runtime";
import { useMurmurBilling } from "../../lib/billing/context";
import { HeroPoints } from "../heroPoints";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { EmailSignInButton, SocialSignInButtons } from "./socialButtons";

// Shown right after a guest pays: signing in is what lets the plan follow them to a new phone.
export function SavePurchaseScreen(): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { t } = useUiLocale();
  const [error, setError] = useState<string | null>(null);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const saved = billing.customer?.isRegistered === true;
  const savedAnnouncement = `${t("savePurchase.savedTitle")}. ${t("savePurchase.savedBody")}`;

  // Sign-in swaps the focused controls for the saved state in place, so screen readers hear it.
  useEffect(() => {
    if (saved) {
      AccessibilityInfo.announceForAccessibility(savedAnnouncement);
    }
  }, [saved, savedAnnouncement]);

  if (saved) {
    return (
      <ScreenScaffold
        artwork={savePurchaseIllustration}
        footer={<PrimaryAction label={t("auth.done")} onPress={leave} />}
        lead={t("savePurchase.savedBody")}
        title={t("savePurchase.savedTitle")}
      />
    );
  }

  return (
    <ScreenScaffold
      artwork={savePurchaseIllustration}
      footer={(
        <>
          <StatusLine error={error} notice={null} />
          <SocialSignInButtons disabled={billing.busy} onError={setError} />
          <EmailSignInButton disabled={billing.busy} label={t("auth.continueEmail")} onPress={() => router.replace("/sign-in")} />
          <QuietAction label={t("savePurchase.notNow")} onPress={leave} />
        </>
      )}
      lead={t("savePurchase.body")}
      title={t("savePurchase.title")}
    >
      <HeroPoints
        points={[
          { icon: Clock, text: t("savePurchase.minutesToo") },
          { icon: KeyRound, text: t("savePurchase.noPassword") },
        ]}
      />
    </ScreenScaffold>
  );
}
