const app = require("./app.json").expo;
const withHistoryBackupExclusion = require("./plugins/withHistoryBackupExclusion");
const withIosPodDeploymentTarget = require("./plugins/withIosPodDeploymentTarget");

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosUrlScheme = iosClientId?.endsWith(".apps.googleusercontent.com")
  ? `com.googleusercontent.apps.${iosClientId.slice(0, -".apps.googleusercontent.com".length)}`
  : "com.googleusercontent.apps.not-configured";
// EAS builds inject the update channel; local signed builds pass it explicitly.
const updatesChannel = process.env.MURMUR_UPDATES_CHANNEL?.trim();

module.exports = ({ config }) => ({
  ...config,
  ...app,
  ios: {
    ...app.ios,
    usesAppleSignIn: true,
    deploymentTarget: "16.4",
  },
  updates: updatesChannel
    ? { ...app.updates, requestHeaders: { ...app.updates.requestHeaders, "expo-channel-name": updatesChannel } }
    : app.updates,
  plugins: [
    ...app.plugins,
    ["expo-build-properties", { ios: { enableSceneSupport: true } }],
    "expo-apple-authentication",
    ["@react-native-google-signin/google-signin", { iosUrlScheme }],
    withHistoryBackupExclusion,
    withIosPodDeploymentTarget,
  ],
});
