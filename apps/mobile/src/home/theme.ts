import { useColorScheme } from "react-native";

export type MurmurTheme = {
  action: string;
  background: string;
  chromeButton: string;
  coral: string;
  dark: boolean;
  gold: string;
  hairline: string;
  input: string;
  muted: string;
  onAction: string;
  onPrimary: string;
  primary: string;
  scrim: string;
  selected: string;
  selectedBorder: string;
  surface: string;
  teal: string;
  violet: string;
};

export const lightMurmurTheme: MurmurTheme = {
  action: "#3A2E3F",
  background: "#FAF3E7",
  chromeButton: "rgba(255, 253, 249, 0.76)",
  coral: "#F0655A",
  dark: false,
  gold: "#F7B92B",
  hairline: "rgba(58, 46, 63, 0.12)",
  input: "rgba(58, 46, 63, 0.06)",
  muted: "#746A79",
  onAction: "#FAF3E7",
  onPrimary: "#FAF3E7",
  primary: "#3A2E3F",
  scrim: "rgba(35, 27, 38, 0.34)",
  selected: "rgba(47, 185, 165, 0.08)",
  selectedBorder: "rgba(47, 185, 165, 0.24)",
  surface: "#FFFDF9",
  teal: "#2FB9A5",
  violet: "#8662E6",
};

export const darkMurmurTheme: MurmurTheme = {
  action: "#FF746A",
  background: "#171319",
  chromeButton: "rgba(42, 34, 46, 0.88)",
  coral: "#FF746A",
  dark: true,
  gold: "#F8C552",
  hairline: "rgba(250, 243, 231, 0.15)",
  input: "#2A232D",
  muted: "#B9ACBC",
  onAction: "#24171F",
  onPrimary: "#24171F",
  primary: "#FFF6EC",
  scrim: "rgba(3, 2, 4, 0.72)",
  selected: "rgba(77, 216, 191, 0.16)",
  selectedBorder: "rgba(77, 216, 191, 0.38)",
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
