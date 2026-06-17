import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { styles } from "./styles";

export function ModalSheet({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}): ReactNode {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalScrim}>
        <SafeAreaView style={styles.sheet}>
          <ModalSheetHeader onClose={onClose} title={title} />
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function ModalSheetHeader({ onClose, title }: { onClose: () => void; title: string }): ReactNode {
  return (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetDone}>
        <Text style={styles.sheetDoneText}>Done</Text>
      </Pressable>
    </View>
  );
}
