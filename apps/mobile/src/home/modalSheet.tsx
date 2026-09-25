import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react-native";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  uiContentDirectionStyle,
  uiTextDirectionStyle,
  useUiLocale,
} from "../i18n/runtime";
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
  const { direction, locale, t } = useUiLocale();
  const androidKeyboardInset = useAndroidKeyboardInset();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={open}
    >
      <View style={[styles.modalScrim, uiContentDirectionStyle(locale)]}>
        <Pressable
          accessibilityLabel={t("accessibility.closeSheet")}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.sheetDismissArea}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={[
            styles.sheetKeyboard,
            uiContentDirectionStyle(direction),
            { paddingBottom: androidKeyboardInset },
          ]}
        >
          <SafeAreaView edges={["bottom"]} style={[styles.sheet, uiContentDirectionStyle(direction)]}>
            <View accessibilityElementsHidden style={styles.sheetHandle} />
            <ModalSheetHeader onClose={onClose} title={title} />
            {scroll ? (
              <ScrollView
                contentContainerStyle={sheetContent}
                keyboardDismissMode="interactive"
                style={sheetScroll}
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

// Android runs edge to edge, so the window doesn't resize for the keyboard and
// KeyboardAvoidingView misreads the overlap inside a translucent modal. Lift the
// sheet by the keyboard's own height instead.
function useAndroidKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const show = Keyboard.addListener("keyboardDidShow", (event) => setInset(event.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return inset;
}

const sheetContent = { paddingBottom: 32 } as const;
// Without flexShrink the scroll view grows to its content and the sheet clips it on iOS.
const sheetScroll = { flexShrink: 1 } as const;

function ModalSheetHeader({ onClose, title }: { onClose: () => void; title: string }): ReactNode {
  const { colors, styles } = useSheetStyles();
  const { direction, t } = useUiLocale();
  return (
    <View style={[styles.sheetHeader, uiContentDirectionStyle(direction)]}>
      <Text style={[styles.sheetTitle, uiTextDirectionStyle(direction)]}>{title}</Text>
      <Pressable
        accessibilityLabel={t("accessibility.close")}
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
