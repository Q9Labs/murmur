import type { ReactNode } from "react";
import { X } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSheetStyles } from "./sheetStyles";

export function ModalSheet({
  children,
  onClose,
  open,
  scroll = false,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  scroll?: boolean;
  title: string;
}): ReactNode {
  const { styles } = useSheetStyles();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={open}
    >
      <View style={styles.modalScrim}>
        <Pressable
          accessibilityLabel="Close sheet"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.sheetDismissArea}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={styles.sheetKeyboard}
        >
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View accessibilityElementsHidden style={styles.sheetHandle} />
            <ModalSheetHeader onClose={onClose} title={title} />
            {scroll ? (
              <ScrollView
                contentContainerStyle={sheetContent}
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const sheetContent = { paddingBottom: 24 } as const;

function ModalSheetHeader({ onClose, title }: { onClose: () => void; title: string }): ReactNode {
  const { colors, styles } = useSheetStyles();
  return (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onClose}
        style={({ pressed }) => [styles.sheetDone, pressed && styles.pressed]}
      >
        <X color={colors.primary} size={20} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
