import { StyleSheet } from "react-native";

import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "../../home/theme";

function createPlanStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    benefit: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10,
    },
    benefitDot: {
      backgroundColor: theme.teal,
      borderRadius: 999,
      height: 7,
      marginTop: 8,
      width: 7,
    },
    benefitDotSelected: {
      backgroundColor: theme.selectedAccent,
    },
    benefitText: {
      color: theme.secondaryText,
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
    },
    benefitTextSelected: {
      color: theme.onSelectedSecondary,
    },
    benefits: {
      gap: 6,
    },
    caption: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
      textAlign: "center",
    },
    card: {
      backgroundColor: theme.input,
      borderRadius: 28,
      gap: 14,
      padding: 22,
    },
    cardHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    cardSelected: {
      backgroundColor: theme.selected,
    },
    cardTitle: {
      color: theme.primary,
      flex: 1,
      fontSize: 17,
      fontWeight: "800",
    },
    cardTitleSelected: {
      color: theme.onSelected,
    },
    cards: {
      gap: 10,
    },
    cta: {
      alignItems: "center",
      backgroundColor: theme.action,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 24,
    },
    ctaDisabled: {
      backgroundColor: theme.input,
      borderColor: theme.hairline,
      borderStyle: "dashed",
      borderWidth: 1,
    },
    ctaText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
    ctaTextDisabled: {
      color: theme.muted,
    },
    offer: {
      alignItems: "center",
      backgroundColor: theme.selected,
      borderRadius: 22,
      columnGap: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      rowGap: 4,
    },
    offerCountdown: {
      color: theme.onSelectedSecondary,
      fontSize: 16,
      fontVariant: ["tabular-nums"],
      fontWeight: "700",
    },
    offerTitle: {
      color: theme.onSelected,
      fontSize: 17,
      fontWeight: "800",
    },
    picker: {
      gap: 14,
    },
    price: {
      color: theme.primary,
      fontSize: 44,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    priceSelected: {
      color: theme.onSelected,
    },
    priceRow: {
      alignItems: "baseline",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    priceSuffix: {
      color: theme.secondaryText,
      fontSize: 16,
      fontWeight: "700",
    },
    priceSuffixSelected: {
      color: theme.onSelectedSecondary,
    },
    pressed: {
      opacity: 0.6,
    },
    radio: {
      alignItems: "center",
      borderColor: theme.muted,
      borderRadius: 999,
      borderWidth: 1.5,
      height: 24,
      justifyContent: "center",
      width: 24,
    },
    radioSelected: {
      backgroundColor: theme.selectedAccent,
      borderColor: theme.selectedAccent,
    },
    retry: {
      alignItems: "center",
      borderColor: theme.hairline,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
    },
    retryText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "800",
    },
    status: {
      color: theme.secondaryText,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
    },
    statusError: {
      color: theme.danger,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20,
    },
    tab: {
      alignItems: "center",
      borderRadius: 999,
      flex: 1,
      justifyContent: "center",
      minHeight: 40,
      paddingHorizontal: 10,
    },
    tabActive: {
      backgroundColor: theme.selected,
    },
    tabBar: {
      backgroundColor: theme.input,
      borderRadius: 999,
      flexDirection: "row",
      padding: 4,
    },
    tabText: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    tabTextActive: {
      color: theme.onSelected,
      fontWeight: "800",
    },
  });
}

export type PlanStyles = ReturnType<typeof createPlanStyles>;

const lightStyles = createPlanStyles(lightMurmurTheme);
const darkStyles = createPlanStyles(darkMurmurTheme);

export function usePlanStyles(): { colors: MurmurTheme; styles: PlanStyles } {
  const colors = useMurmurTheme();
  return { colors, styles: colors.dark ? darkStyles : lightStyles };
}
