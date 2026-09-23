import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const historyBackupPlugin = require("./withHistoryBackupExclusion");
const { addHistoryBackupExclusion } = historyBackupPlugin;
const appConfig = require("../app.json").expo;
const resolveAppConfig = require("../app.config.js");

const generatedAppDelegate = `import Expo
@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

describe("local history platform backup exclusions", () => {
  it("excludes the iOS history directory from backup during app launch", () => {
    const patched = addHistoryBackupExclusion(generatedAppDelegate);

    expect(patched).toContain("excludeMurmurHistoryFromBackup()");
    expect(patched).toContain('appendingPathComponent("conversation-history", isDirectory: true)');
    expect(patched).toContain("resourceValues.isExcludedFromBackup = true");
    expect(patched).toContain("setResourceValues(resourceValues)");
    expect(addHistoryBackupExclusion(patched)).toBe(patched);
  });

  it("disables Android Auto Backup for the app and registers the iOS plugin", () => {
    const resolved = resolveAppConfig({ config: appConfig });

    expect(resolved.android.allowBackup).toBe(false);
    expect(resolved.plugins).toContain(historyBackupPlugin);
  });
});
