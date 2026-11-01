import { StyleSheet } from "react-native";

import { useMurmurTheme } from "../../home/theme";
import { serifFontFamily } from "../../lib/serifFont";

export function usePaywallStyles() {
  const colors = useMurmurTheme();
  const styles = StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 8 },
    backRow: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, justifyContent: "center", marginStart: -10, minHeight: 44, paddingHorizontal: 10 },
    backText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
    purchase: { marginTop: "auto", gap: 4, paddingTop: 16 },
    heading: { color: colors.primary, fontFamily: serifFontFamily, fontSize: 34, fontWeight: "800", letterSpacing: -0.4, lineHeight: 42 },
    lead: { color: colors.secondaryText, fontSize: 16, fontWeight: "500", lineHeight: 24, marginTop: 12 },
    facts: { gap: 14, marginTop: 28 },
    factRow: { alignItems: "center", flexDirection: "row", gap: 12 },
    factText: { color: colors.primary, flexShrink: 1, fontSize: 15, fontWeight: "500", lineHeight: 22 },
    planCards: { gap: 10, marginTop: 24 },
    planCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, justifyContent: "space-between", minHeight: 44, paddingHorizontal: 18, paddingVertical: 14 },
    planCardSelected: { borderColor: colors.primary, borderWidth: 1.5 },
    planCardText: { flex: 1, gap: 2 },
    planCardTitle: { color: colors.primary, fontSize: 17, fontWeight: "700", lineHeight: 23 },
    planCardDetail: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    noticeCard: { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: 14, borderWidth: 1, gap: 4, marginTop: 16, padding: 14 },
    noticeTitle: { color: colors.primary, fontSize: 15, fontWeight: "700" },
    noticeBody: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
    links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 12, marginTop: 16 },
    link: { minHeight: 44, minWidth: 44, justifyContent: "center", alignSelf: "center" },
    linkText: { color: colors.secondaryText, fontSize: 12, fontWeight: "600", textDecorationLine: "underline", textAlign: "center" },
    dimmed: { opacity: 0.5 },
  });
  return { colors, styles };
}
