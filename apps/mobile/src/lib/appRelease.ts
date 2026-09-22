import Constants from "expo-constants";
import { Platform } from "react-native";

export type AppRelease = {
  app_platform: string;
  app_version: string;
};

export function getAppRelease(): AppRelease {
  return {
    app_platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? "unknown",
  };
}
