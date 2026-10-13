import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { setPodDeploymentTarget } = require("./withIosPodDeploymentTarget");
const podfile = `target 'Murmur' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

describe("iOS Pod deployment targets", () => {
  it("raises dependency and resource-bundle targets without lowering newer targets", () => {
    const patched = setPodDeploymentTarget(podfile);
    expect(patched).toContain("installer.pods_project.targets.each");
    expect(patched).toContain("Gem::Version.new(current_target) < Gem::Version.new(minimum_target)");
    expect(patched).toContain("podfile_properties.fetch('ios.deploymentTarget')");
    expect(patched).toMatch(/react_native_post_install\([\s\S]*murmur-pod-deployment-target[\s\S]*\n  end\nend/);
    expect(setPodDeploymentTarget(patched)).toBe(patched);
  });

  it("refuses an unknown template instead of silently skipping the build fix", () => {
    expect(() => setPodDeploymentTarget("post_install do |installer|\nend")).toThrow("post-install hook");
  });
});
