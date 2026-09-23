const { createRunOncePlugin, withAppDelegate } = require("expo/config-plugins");

const pkg = require("../package.json");
const marker = "// @murmur-history-backup-exclusion";
const appDelegateLaunchReturn = /^([ \t]*)return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)$/m;

function addHistoryBackupExclusion(contents) {
  if (contents.includes(marker)) return contents;

  const launchReturn = contents.match(appDelegateLaunchReturn);
  if (!launchReturn) {
    throw new Error("Unable to locate AppDelegate launch return for local history backup exclusion");
  }

  const patched = contents.replace(
    appDelegateLaunchReturn,
    `${launchReturn[1]}excludeMurmurHistoryFromBackup()\n${launchReturn[0]}`,
  );
  return `${patched}\n\n${marker}\nprivate func excludeMurmurHistoryFromBackup() {
    let fileManager = FileManager.default
    guard let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
        return
    }
    var historyDirectory = documents.appendingPathComponent("conversation-history", isDirectory: true)
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    do {
        try fileManager.createDirectory(at: historyDirectory, withIntermediateDirectories: true)
        try historyDirectory.setResourceValues(resourceValues)
    } catch {
        NSLog("Murmur could not exclude local history from backup: %@", error.localizedDescription)
    }
}\n`;
}

function withHistoryBackupExclusion(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== "swift") {
      throw new Error("Local history backup exclusion requires a Swift AppDelegate");
    }
    mod.modResults.contents = addHistoryBackupExclusion(mod.modResults.contents);
    return mod;
  });
}

module.exports = createRunOncePlugin(withHistoryBackupExclusion, "withHistoryBackupExclusion", pkg.version);
module.exports.addHistoryBackupExclusion = addHistoryBackupExclusion;
