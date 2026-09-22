import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useState } from "react";
import type { ReactNode } from "react";
import { Image, Platform, Pressable, StyleSheet, Text } from "react-native";

import { captureMobileFailure } from "../lib/observability/sentry";
import { updateRequiredIllustration } from "./illustrations";
import { ModalSheet } from "./modalSheet";
import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "./theme";

type StoreListing = {
  label: string;
  url: string;
};

type StoreConfig = {
  android?: { playStoreUrl?: string };
  ios?: { appStoreUrl?: string };
};

export function storeListing(platform: string, config: StoreConfig | null | undefined): StoreListing | null {
  if (platform === "ios" && config?.ios?.appStoreUrl) {
    return { label: "Update in the App Store", url: config.ios.appStoreUrl };
  }
  if (platform === "android" && config?.android?.playStoreUrl) {
    return { label: "Update on Google Play", url: config.android.playStoreUrl };
  }
  return null;
}

export function UpdateRequiredSheet(props: { onClose: () => void; open: boolean }): ReactNode {
  const styles = useUpdateRequiredStyles();
  const [openFailed, setOpenFailed] = useState(false);
  const listing = storeListing(Platform.OS, Constants.expoConfig);

  function openStore(url: string): void {
    setOpenFailed(false);
    Linking.openURL(url).catch((failure: unknown) => {
      captureMobileFailure(failure, { operation: "open_store_listing", stage: "update_required" });
      setOpenFailed(true);
    });
  }

  return (
    <ModalSheet onClose={props.onClose} open={props.open} scroll title="Update Murmur">
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="contain"
        source={updateRequiredIllustration}
        style={styles.illustration}
      />
      <Text style={styles.body}>
        A newer version of Murmur is ready. This version can no longer start translations, so
        update to keep the conversation going.
      </Text>
      {listing ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => openStore(listing.url)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{listing.label}</Text>
        </Pressable>
      ) : null}
      {openFailed || !listing ? (
        <Text accessibilityLiveRegion="assertive" style={styles.caption}>
          Open your app store and search for Murmur to update.
        </Text>
      ) : null}
    </ModalSheet>
  );
}

function createUpdateRequiredStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    body: {
      color: theme.muted,
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
    },
    button: {
      alignItems: "center",
      backgroundColor: theme.action,
      borderRadius: 999,
      justifyContent: "center",
      marginTop: 24,
      minHeight: 56,
      paddingHorizontal: 24,
    },
    buttonText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
    caption: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
      marginTop: 14,
      textAlign: "center",
    },
    illustration: {
      alignSelf: "center",
      height: 140,
      marginBottom: 12,
      width: 200,
    },
    pressed: {
      opacity: 0.55,
    },
  });
}

const lightStyles = createUpdateRequiredStyles(lightMurmurTheme);
const darkStyles = createUpdateRequiredStyles(darkMurmurTheme);

function useUpdateRequiredStyles(): ReturnType<typeof createUpdateRequiredStyles> {
  return useMurmurTheme().dark ? darkStyles : lightStyles;
}
