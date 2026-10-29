import { NativeModules } from "react-native";

export function isNativeDevelopmentClient(): boolean {
  // ExpoDevLauncher has an Android release stub; EXDevLauncher identifies the actual native launcher.
  return NativeModules.EXDevLauncher != null;
}
