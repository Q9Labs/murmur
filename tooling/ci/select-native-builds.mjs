import { readFileSync } from "node:fs";

const paths = readFileSync(0, "utf8").split("\0").filter(Boolean);
const mobileChanged = paths.some(
  (file) =>
    file.startsWith("apps/mobile/") ||
    file.startsWith("packages/") ||
    file.startsWith("patches/") ||
    file.startsWith("tooling/ci/") ||
    file.startsWith(".github/workflows/") ||
    /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|tsconfig[^/]*\.json)$/.test(file),
);

console.log(`native=${mobileChanged}`);
