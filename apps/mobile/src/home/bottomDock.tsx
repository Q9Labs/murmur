import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { formatLiveError, formatReportError } from "./errorCopy";
import { styles } from "./styles";

export function BottomDock({
  canStart,
  error,
  isLive,
  onPrimaryAction,
  reportError,
  reportReceiptId,
}: {
  canStart: boolean;
  error: string | null;
  isLive: boolean;
  onPrimaryAction: () => void;
  reportError: string | null;
  reportReceiptId: string | null;
}): ReactNode {
  const disabled = !isLive && !canStart;

  return (
    <View style={styles.bottomDock}>
      <DockMessages error={error} reportError={reportError} reportReceiptId={reportReceiptId} />
      <Text style={styles.listenHint}>
        {getListenHint(isLive)}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPrimaryAction}
        style={({ pressed }) => getListenButtonStyle({ disabled, isLive, pressed })}
      >
        <Text style={styles.listenButtonText}>{getListenButtonLabel(isLive)}</Text>
      </Pressable>
    </View>
  );
}

function DockMessages({
  error,
  reportError,
  reportReceiptId,
}: {
  error: string | null;
  reportError: string | null;
  reportReceiptId: string | null;
}): ReactNode {
  return (
    <>
      <LiveErrorMessage error={error} />
      {reportError ? <Text style={styles.error}>{formatReportError(reportError)}</Text> : null}
      {reportReceiptId ? (
        <Text style={styles.receipt}>Report received: {reportReceiptId.slice(0, 8)}</Text>
      ) : null}
    </>
  );
}

function LiveErrorMessage({ error }: { error: string | null }): ReactNode {
  if (!error || error === "microphone_permission_denied") {
    return null;
  }
  return <Text style={styles.error}>{formatLiveError(error)}</Text>;
}

function getListenHint(isLive: boolean): string {
  return isLive ? "Listening for speech" : "Microphone stays off until you tap Listen.";
}

function getListenButtonLabel(isLive: boolean): string {
  return isLive ? "Stop" : "Listen";
}

function getListenButtonStyle(params: {
  disabled: boolean;
  isLive: boolean;
  pressed: boolean;
}): ViewStyle[] {
  const result: ViewStyle[] = [styles.listenButton];
  if (params.isLive) {
    result.push(styles.stopButton);
  }
  if (params.pressed || params.disabled) {
    result.push(styles.pressed);
  }
  return result;
}
