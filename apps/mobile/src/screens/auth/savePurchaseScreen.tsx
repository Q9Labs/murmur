import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { useMurmurBilling } from "../../lib/billing/context";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenStyles } from "../styles";
import { EmailSignInButton, SocialSignInButtons } from "./socialButtons";
import { useAuthStyles } from "./styles";

export function SavePurchaseScreen(): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { colors, styles } = useAuthStyles();
  const screen = useScreenStyles().styles;
  const [error, setError] = useState<string | null>(null);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (billing.customer?.isRegistered) {
    return (
      <ScreenScaffold footer={<PrimaryAction label="Done" onPress={leave} />} title="Purchase saved">
        <View accessibilityElementsHidden importantForAccessibility="no" style={styles.doneBadge}>
          <Check color={colors.teal} size={30} strokeWidth={2.5} />
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.body, styles.centered]}>
          Sign in on any phone to get it back.
        </Text>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      footer={<QuietAction label="Not now" onPress={leave} />}
      title="Save your purchase"
    >
      <Text style={screen.body}>Sign in so your plan stays yours on a new phone.</Text>
      <View style={styles.flow}>
        <SocialSignInButtons disabled={billing.busy} onError={setError} />
        <EmailSignInButton disabled={billing.busy} label="Continue with email" onPress={() => router.replace("/sign-in")} />
      </View>
      <StatusLine error={error} notice={null} />
    </ScreenScaffold>
  );
}
