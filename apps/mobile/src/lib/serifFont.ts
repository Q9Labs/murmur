import { Platform } from "react-native";

// No bundled fonts: iOS ships Georgia, Android resolves "serif" to Noto Serif.
// Falls back to the platform default anywhere else so the style still renders.
export const serifFontFamily: string | undefined =
  typeof Platform.select === "function"
    ? Platform.select({ android: "serif", default: "serif", ios: "Georgia" })
    : "serif";
