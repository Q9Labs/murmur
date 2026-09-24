import { useColorScheme } from "react-native";

export type MurmurTheme = {
  action: string;
  background: string;
  chromeButton: string;
  coral: string;
  danger: string;
  dark: boolean;
  gold: string;
  hairline: string;
  input: string;
  muted: string;
  onAction: string;
  onPrimary: string;
  onSelected: string;
  onSelectedSecondary: string;
  primary: string;
  scrim: string;
  secondaryText: string;
  selected: string;
  selectedAccent: string;
  surface: string;
  teal: string;
  violet: string;
};

export const lightMurmurTheme: MurmurTheme = {
  action: "#3A2E3F",
  background: "#FAF3E7",
  chromeButton: "rgba(255, 253, 249, 0.76)",
  coral: "#F0655A",
  danger: "#B33A3A",
  dark: false,
  gold: "#F7B92B",
  hairline: "rgba(58, 46, 63, 0.12)",
  input: "rgba(58, 46, 63, 0.06)",
  muted: "#746A79",
  onAction: "#FAF3E7",
  onPrimary: "#FAF3E7",
  onSelected: "#FAF3E7",
  onSelectedSecondary: "#CFC4CC",
  primary: "#3A2E3F",
  scrim: "rgba(35, 27, 38, 0.34)",
  secondaryText: "#5E5463",
  selected: "#3A2E3F",
  selectedAccent: "#5FE0C6",
  surface: "#FFFDF9",
  teal: "#2FB9A5",
  violet: "#8662E6",
};

export const darkMurmurTheme: MurmurTheme = {
  action: "#FF746A",
  background: "#171319",
  chromeButton: "rgba(42, 34, 46, 0.88)",
  coral: "#FF746A",
  danger: "#FF8A80",
  dark: true,
  gold: "#F8C552",
  hairline: "rgba(250, 243, 231, 0.15)",
  input: "#2A232D",
  muted: "#B9ACBC",
  onAction: "#24171F",
  onPrimary: "#24171F",
  onSelected: "#211A24",
  onSelectedSecondary: "#5E5463",
  primary: "#FFF6EC",
  scrim: "rgba(3, 2, 4, 0.72)",
  secondaryText: "#D2C6D4",
  selected: "#F2E8DA",
  selectedAccent: "#08706C",
  surface: "#211B24",
  teal: "#4DD8BF",
  violet: "#B093FF",
};

export function resolveMurmurTheme(scheme: "dark" | "light" | null | undefined): MurmurTheme {
  return scheme === "dark" ? darkMurmurTheme : lightMurmurTheme;
}

export function useMurmurTheme(): MurmurTheme {
  return resolveMurmurTheme(useColorScheme());
}
