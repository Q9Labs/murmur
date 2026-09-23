import { useEffect, useRef, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text } from "react-native";

import { formatUiNumber, type UiText, useUiLocale } from "../i18n/runtime";
import { freeAllowanceMinutes, isPaidCustomer } from "../lib/billing/allowance";
import type { MurmurCustomer } from "../lib/billing/customerResponse";
import { outOfMinutesIllustration } from "./illustrations";
import { ModalSheet } from "./modalSheet";
import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "./theme";

export function OutOfMinutesSheet(props: {
  customer: MurmurCustomer | null;
  onClose: () => void;
  onSeePlans: () => void;
  open: boolean;
}): ReactNode {
  const styles = useMurmurTheme().dark ? darkStyles : lightStyles;
  const ui = useUiLocale();
  useCloseWhenBalanceRecovers(props.open, props.customer?.availableMs ?? 0, props.onClose);
  return (
    <ModalSheet onClose={props.onClose} open={props.open} title={ui.t("outOfMinutes.title")}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="contain"
        source={outOfMinutesIllustration}
        style={styles.illustration}
      />
      <Text style={styles.body}>{outOfMinutesMessage(props.customer, ui)}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={props.onSeePlans}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{ui.t("outOfMinutes.seePlans")}</Text>
      </Pressable>
    </ModalSheet>
  );
}

export function balanceRecovered(availableWhenOpenedMs: number, availableMs: number): boolean {
  return availableMs > availableWhenOpenedMs;
}

function useCloseWhenBalanceRecovers(open: boolean, availableMs: number, onClose: () => void): void {
  const latestAvailableMs = useRef(availableMs);
  const availableWhenOpenedMs = useRef(availableMs);
  latestAvailableMs.current = availableMs;

  useEffect(() => {
    if (open) {
      availableWhenOpenedMs.current = latestAvailableMs.current;
    }
  }, [open]);

  useEffect(() => {
    if (open && balanceRecovered(availableWhenOpenedMs.current, availableMs)) {
      onClose();
    }
  }, [availableMs, onClose, open]);
}

export function outOfMinutesMessage(customer: MurmurCustomer | null, ui: UiText): string {
  if (customer && isPaidCustomer(customer)) {
    return ui.t("outOfMinutes.paid");
  }
  return ui.t("outOfMinutes.free", { minutes: formatUiNumber(freeAllowanceMinutes, ui.locale) });
}

function createOutOfMinutesStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    body: {
      color: theme.secondaryText,
      fontSize: 17,
      lineHeight: 25,
      textAlign: "center",
    },
    button: {
      alignItems: "center",
      backgroundColor: theme.action,
      borderRadius: 999,
      justifyContent: "center",
      marginBottom: 8,
      marginTop: 24,
      minHeight: 56,
      paddingHorizontal: 24,
    },
    buttonText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
    illustration: {
      alignSelf: "center",
      height: 120,
      marginBottom: 16,
      width: 172,
    },
    pressed: {
      opacity: 0.55,
    },
  });
}

const lightStyles = createOutOfMinutesStyles(lightMurmurTheme);
const darkStyles = createOutOfMinutesStyles(darkMurmurTheme);
