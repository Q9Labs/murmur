import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Platform, Text, View } from "react-native";

import { useMurmurBilling } from "../../lib/billing/context";
import { PrimaryAction, QuietAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useScreenServices } from "../screenServices";
import { useScreenStyles } from "../styles";
import { AppleSignInButton, EmailSignInButton, GoogleSignInButton } from "./socialButtons";
import { useAuthStyles } from "./styles";

type SocialProvider = "apple" | "google";

export function SavePurchaseScreen(): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const services = useScreenServices();
  const { colors, styles } = useAuthStyles();
  const screen = useScreenStyles().styles;
  const [pending, setPending] = useState<SocialProvider | null>(null);
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

  const signIn = (provider: SocialProvider) => {
    setPending(provider);
    setError(null);
    const action = provider === "apple" ? services.signInWithApple : services.signInWithGoogle;
    action()
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "Sign-in didn't finish. Try again.");
      })
      .finally(() => setPending(null));
  };
  const locked = pending !== null || billing.busy;

  return (
    <ScreenScaffold
      footer={<QuietAction label="Not now" onPress={leave} />}
      title="Save your purchase"
    >
      <Text style={screen.body}>Sign in so your plan stays yours on a new phone.</Text>
      <View style={styles.flow}>
        {Platform.OS === "ios" ? (
          <AppleSignInButton
            disabled={locked}
            label={pending === "apple" ? "Signing in…" : "Continue with Apple"}
            onPress={() => signIn("apple")}
          />
        ) : null}
        <GoogleSignInButton
          disabled={locked}
          label={pending === "google" ? "Signing in…" : "Continue with Google"}
          onPress={() => signIn("google")}
        />
        <EmailSignInButton disabled={locked} label="Continue with email" onPress={() => router.replace("/sign-in")} />
      </View>
      <StatusLine error={error} notice={null} />
    </ScreenScaffold>
  );
}
