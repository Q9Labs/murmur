const app = require("./app.json").expo;
const withHistoryBackupExclusion = require("./plugins/withHistoryBackupExclusion");

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosUrlScheme = iosClientId?.endsWith(".apps.googleusercontent.com")
  ? `com.googleusercontent.apps.${iosClientId.slice(0, -".apps.googleusercontent.com".length)}`
  : "com.googleusercontent.apps.not-configured";

module.exports = ({ config }) => ({
  ...config,
  ...app,
  ios: {
    ...app.ios,
    usesAppleSignIn: true,
  },
  plugins: [
    ...app.plugins,
    "expo-apple-authentication",
    ["@react-native-google-signin/google-signin", { iosUrlScheme }],
    withHistoryBackupExclusion,
  ],
});
