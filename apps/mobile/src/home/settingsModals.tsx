import * as Linking from "expo-linking";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { AccountBillingModal } from "./accountBillingModal";
import { ModalSheet } from "./modalSheet";
import { useSheetStyles } from "./sheetStyles";

const legalUrls = {
  privacy: "https://murmur.q9labs.ai/privacy",
  support: "https://murmur.q9labs.ai/support",
  terms: "https://murmur.q9labs.ai/terms",
} as const;

export function SettingsModal(props: {
  anonymousAnalyticsEnabled: boolean;
  developerToolsEnabled: boolean;
  live: LiveTranslationController;
  onClose: () => void;
  onAnonymousAnalyticsEnabledChange: (enabled: boolean) => void;
  onDeleteLocalData: () => void;
  onOpenDiagnostics: () => void;
  onResetIdentity: () => void;
  onShare: () => void;
  open: boolean;
  settingsMessage: string | null;
}): ReactNode {
  const { styles } = useSheetStyles();
  const [accountBillingOpen, setAccountBillingOpen] = useState(false);
  const disabled = props.live.status === "live";
  return (
    <>
      <ModalSheet onClose={props.onClose} open={props.open} scroll title="Settings">
        <View style={styles.settingsList}>
          <SettingsAction
            disabled={disabled}
            label="Account & billing"
            onPress={() => setAccountBillingOpen(true)}
          />
          <SettingsAction disabled={disabled} label="Share Murmur" onPress={props.onShare} />
        <SettingsAction
          disabled={disabled}
          label={`Anonymous analytics: ${props.anonymousAnalyticsEnabled ? "On" : "Off"}`}
          onPress={() => props.onAnonymousAnalyticsEnabledChange(!props.anonymousAnalyticsEnabled)}
        />
        <SettingsAction
          label="Privacy policy"
          onPress={() => void Linking.openURL(legalUrls.privacy)}
        />
        <SettingsAction label="Terms of use" onPress={() => void Linking.openURL(legalUrls.terms)} />
        <SettingsAction
          label="Support & data requests"
          onPress={() => void Linking.openURL(legalUrls.support)}
        />
        <SettingsAction
          disabled={disabled}
          label="Delete local data"
          onPress={props.onDeleteLocalData}
        />
        <SettingsAction
          label={props.developerToolsEnabled ? "Session diagnostics" : "Report translation"}
          onPress={props.onOpenDiagnostics}
        />
        <SettingsAction
          disabled={disabled}
          label="Reset Murmur Identity"
          onPress={props.onResetIdentity}
        />
        </View>
        {props.settingsMessage ? <Text style={styles.settingsMessage}>{props.settingsMessage}</Text> : null}
      </ModalSheet>
      {props.open && accountBillingOpen ? (
        <AccountBillingModal
          onClose={() => setAccountBillingOpen(false)}
          open
        />
      ) : null}
    </>
  );
}

function SettingsAction(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}): ReactNode {
  const { colors, styles } = useSheetStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.settingsAction,
        (pressed || props.disabled) && styles.pressed,
      ]}
    >
      <Text style={styles.settingsActionText}>{props.label}</Text>
      <ChevronRight color={colors.muted} size={20} strokeWidth={2} />
    </Pressable>
  );
}
