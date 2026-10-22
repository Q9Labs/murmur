import { StyleSheet } from "react-native";

import { useMurmurTheme } from "../../home/theme";

export function usePaywallStyles() {
  const colors = useMurmurTheme();
  const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 8 },
    header: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    demo: { paddingTop: 4, paddingHorizontal: 6, gap: 6, paddingBottom: 8 },
    example: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { backgroundColor: colors.teal, height: 6, width: 6, borderRadius: 3 },
    exampleText: { color: colors.muted, fontSize: 13, fontWeight: "700", flexShrink: 1 },
    caption: { fontSize: 28, lineHeight: 36 },
    source: { fontSize: 16, lineHeight: 24 },
    hidden: { opacity: 0 },
    purchase: { borderTopColor: colors.hairline, borderTopWidth: 1, paddingTop: 10, marginTop: "auto", gap: 4 },
    heading: { color: colors.primary, fontSize: 22, lineHeight: 28, fontWeight: "800" },
    tab: { minHeight: 44 },
    details: { gap: 3 },
    price: { color: colors.primary, fontSize: 18, fontWeight: "800" },
    detail: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
    links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 12 },
    link: { minHeight: 44, minWidth: 44, justifyContent: "center", alignSelf: "center" },
    linkText: { color: colors.secondaryText, fontSize: 12, fontWeight: "600", textDecorationLine: "underline", textAlign: "center" },
    dimmed: { opacity: 0.5 },
  });
  return { colors, styles };
}
