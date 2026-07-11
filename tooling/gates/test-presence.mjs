import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path, { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoots = [
  "apps/mobile/app",
  "apps/mobile/src",
  "apps/mobile/modules",
  "apps/mobile/plugins",
  "apps/worker/src",
  "packages/protocol/src",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const testNamePattern = /(?:^|[./-])(?:test|spec)\.[cm]?[jt]sx?$/;
const ignoredPathPatterns = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.expo(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)build(\/|$)/,
  /(^|\/)assets(\/|$)/,
  /(^|\/)docs(\/|$)/,
  /(^|\/)scratchpad(\/|$)/,
  /(^|\/)store-assets(\/|$)/,
  /(^|\/)fastlane(\/|$)/,
  /(^|\/)tooling(\/|$)/,
  /(^|\/)migrations(\/|$)/,
  /(^|\/)plugins\/.*\.test\.mjs$/,
  /(^|\/)apps\/mobile\/modules\/.*\/android(\/|$)/,
  /(^|\/)apps\/mobile\/modules\/.*\/ios(\/|$)/,
];
const ignoredBasenames = new Set([
  "_layout",
  "index",
  "styles",
  "types",
]);
const explicitPolicyExclusions = new Map([
  [
    "apps/mobile/src/home/homeScreen.tsx",
    "React Native home-screen orchestration coordinates hooks and platform APIs; its pure view-model, provider, and persistence decisions are covered by focused tests while direct coverage requires a native hook harness.",
  ],
  [
    "apps/mobile/src/home/components.tsx",
    "React Native screen composition extracted from the mobile route entry; behavior is covered through route-level flows and direct unit tests would require a renderer/native harness.",
  ],
  [
    "apps/mobile/src/home/appChrome.tsx",
    "React Native presentation component; app status and view-model decisions are covered by focused helper tests.",
  ],
  [
    "apps/mobile/src/home/bottomDock.tsx",
    "React Native presentation component; error copy is covered by focused home tests.",
  ],
  [
    "apps/mobile/src/home/diagnosticsModal.tsx",
    "React Native diagnostics presentation around Expo sharing APIs; pure diagnostics formatting remains covered separately.",
  ],
  [
    "apps/mobile/src/home/experience.tsx",
    "React Native home-screen composition split into smaller presentation components; pure decision logic is covered by home view-model and status tests.",
  ],
  [
    "apps/mobile/src/home/languageControls.tsx",
    "React Native language/mode controls; state decisions are covered by view-model tests and route-level flows.",
  ],
  [
    "apps/mobile/src/home/variants/classic.tsx",
    "Composition-only shell around existing home components; decision logic is covered by view-model and variants/logic tests.",
  ],
  [
    "apps/mobile/src/home/variants/hooks.ts",
    "React Native Animated/AccessibilityInfo subscriptions; the pure derivations they use live in variants/logic.ts with tests.",
  ],
  [
    "apps/mobile/src/home/variants/shared.tsx",
    "Shared React Native presentation pieces reused by variant shells; span/scroll decision logic is covered by variants/logic tests.",
  ],
  [
    "apps/mobile/src/home/variants/sharedControls.tsx",
    "Shared React Native language/mode/primary-action controls styled per variant; state decisions are covered by view-model tests.",
  ],
  [
    "apps/mobile/src/home/variants/onboardingFlow.tsx",
    "Theme-driven React Native onboarding steps shared by variant shells; onboarding state transitions are owned by apps/mobile/src/home/homeScreen.tsx.",
  ],
  [
    "apps/mobile/src/home/variants/aura/onboarding.tsx",
    "React Native onboarding presentation for the Aura variant; onboarding state transitions are owned by apps/mobile/src/home/homeScreen.tsx and covered there.",
  ],
  [
    "apps/mobile/src/home/variants/bloom/onboarding.tsx",
    "React Native onboarding presentation for the Bloom variant; onboarding state transitions are owned by apps/mobile/src/home/homeScreen.tsx and covered there.",
  ],
  [
    "apps/mobile/src/home/variants/fieldConsole/onboarding.tsx",
    "React Native onboarding presentation for the Field Console variant; onboarding state transitions are owned by apps/mobile/src/home/homeScreen.tsx and covered there.",
  ],
  [
    "apps/mobile/src/home/languagePicker.tsx",
    "React Native modal language picker; direct tests require a renderer/native harness.",
  ],
  [
    "apps/mobile/src/home/modalSheet.tsx",
    "Shared React Native modal shell; direct tests require a renderer/native harness.",
  ],
  [
    "apps/mobile/src/home/onboarding.tsx",
    "React Native onboarding presentation; state transitions are handled by the mobile route entry and pure view-model tests.",
  ],
  [
    "apps/mobile/src/home/onboardingScreen.tsx",
    "React Native onboarding composition around tested language/state helpers; direct tests require a renderer/native harness.",
  ],
  [
    "apps/mobile/src/home/settingsModals.tsx",
    "React Native settings/dev modal presentation; route/model helpers are covered by focused tests.",
  ],
  [
    "apps/mobile/src/home/timeline.tsx",
    "React Native timeline row presentation; translation state shaping is covered by live translation/view-model tests.",
  ],
  [
    "apps/mobile/src/home/translationSurface.tsx",
    "React Native translation surface presentation; surface copy/state is driven by tested view-model helpers.",
  ],
  [
    "apps/mobile/src/home/diagnostics.ts",
    "Diagnostics sharing/download wrapper depends on Expo and React Native platform APIs; exercised through app flows while pure latency formatting remains unit-covered.",
  ],
  [
    "apps/mobile/src/lib/live-translation/useLiveTranslation.ts",
    "Large hook implementation covered through extracted helper/provider/session tests and end-to-end app flows; direct coverage requires a dedicated hook harness.",
  ],
  [
    "apps/mobile/src/lib/live-translation/workerApi.ts",
    "Worker/native API boundary used by the live translation hook; direct tests need React Native/native module mocks and route behavior is covered elsewhere.",
  ],
  [
    "apps/mobile/src/lib/useLiveTranslation.ts",
    "Large React hook covered through provider/session modules and end-to-end app flows; direct unit coverage would require a hook harness.",
  ],
  [
    "apps/mobile/modules/murmur-audio/src/MurmurAudioModule.ts",
    "Native bridge declaration; platform behavior is covered by native modules and the web module unit tests.",
  ],
  [
    "apps/worker/src/routes/report.ts",
    "Worker route handler extracted from index; covered through worker fetch tests plus report/rate-limit helper tests.",
  ],
  [
    "apps/worker/src/routes/session.ts",
    "Worker session route orchestration extracted from index; covered through worker fetch tests plus token/rate-limit helper tests.",
  ],
  [
    "apps/worker/src/routes/summary.ts",
    "Worker summary route orchestration extracted from index; provider prompt/credential behavior is covered by focused helper tests.",
  ],
  [
    "apps/worker/src/sockets/translate.ts",
    "Worker WebSocket orchestration extracted from index; covered through worker socket flows and translation helper/provider tests.",
  ],
  [
    "apps/worker/src/translation/streaming.ts",
    "Translation streaming orchestration coordinates provider, rate-limit, and socket writes; covered through provider parsing, error, and worker integration tests.",
  ],
]);

const tracked = git(["ls-files", ...sourceRoots]);
const untracked = git(["ls-files", "--others", "--exclude-standard", ...sourceRoots]);
const files = [...new Set([...tracked, ...untracked])].sort();
const allFiles = new Set(files);
const testedFiles = findTestedFiles(files, allFiles);
const missing = [];

for (const file of files) {
  if (!isMeaningfulSource(file)) {
    continue;
  }

  if (explicitPolicyExclusions.has(file)) {
    continue;
  }

  if (!hasNearbyTest(file, allFiles, testedFiles)) {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error("Test presence failed. Add a nearby .test/.spec file or extend the explicit gate policy if a source file is intentionally excluded:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Test presence passed.");

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

function isMeaningfulSource(file) {
  const normalized = file.replaceAll("\\", "/");
  const extension = path.extname(normalized);
  const basename = path.basename(normalized, extension);

  if (!sourceExtensions.has(extension)) {
    return false;
  }

  if (normalized.endsWith(".d.ts") || testNamePattern.test(normalized)) {
    return false;
  }

  if (ignoredPathPatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  if (ignoredBasenames.has(basename)) {
    return false;
  }

  if (/\.config\.[cm]?[jt]s$/.test(normalized) || /\.types\.[cm]?[jt]s$/.test(normalized)) {
    return false;
  }

  return true;
}

function hasNearbyTest(file, allFiles, testedFiles) {
  const extension = path.extname(file);
  const withoutExtension = file.slice(0, -extension.length);
  const directory = path.dirname(file);
  const basename = path.basename(withoutExtension);
  const candidates = [
    `${withoutExtension}.test${extension}`,
    `${withoutExtension}.spec${extension}`,
    `${withoutExtension}.test.ts`,
    `${withoutExtension}.test.tsx`,
    `${withoutExtension}.test.js`,
    `${withoutExtension}.test.mjs`,
    path.join(directory, "__tests__", `${basename}.test${extension}`),
    path.join(directory, "__tests__", `${basename}.test.ts`),
    path.join(directory, "__tests__", `${basename}.test.tsx`),
  ].map((candidate) => candidate.replaceAll("\\", "/"));

  return testedFiles.has(file) || candidates.some((candidate) => allFiles.has(candidate) || existsSync(join(repoRoot, candidate)));
}

function findTestedFiles(files, allFiles) {
  const tested = new Set();

  for (const testFile of files.filter((file) => testNamePattern.test(file))) {
    const content = readFileSync(join(repoRoot, testFile), "utf8");
    const directory = path.dirname(testFile);
    const importSpecifiers = [
      ...content.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...content.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...content.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map((match) => match[1]);

    for (const specifier of importSpecifiers) {
      if (!specifier.startsWith(".")) {
        continue;
      }

      for (const resolved of resolveImportTargets(directory, specifier, allFiles)) {
        tested.add(resolved);
      }
    }
  }

  return tested;
}

function resolveImportTargets(directory, specifier, allFiles) {
  const base = path.normalize(path.join(directory, specifier)).replaceAll("\\", "/");
  const candidates = [];

  for (const extension of sourceExtensions) {
    candidates.push(`${base}${extension}`);
    candidates.push(`${base}/index${extension}`);
  }

  return candidates.filter((candidate) => allFiles.has(candidate));
}
