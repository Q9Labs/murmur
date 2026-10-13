const { withPodfile } = require("expo/config-plugins");

const marker = "# @murmur-pod-deployment-target";
const postInstall = /react_native_post_install\([\s\S]*?\n    \)/;

function setPodDeploymentTarget(contents) {
  if (contents.includes(marker)) return contents;
  if (!postInstall.test(contents)) {
    throw new Error("Unable to locate the Expo Podfile post-install hook");
  }
  // CocoaPods leaves some dependency and resource-bundle targets below the app minimum.
  return contents.replace(postInstall, (hook) => `${hook}
    ${marker}
    minimum_target = podfile_properties.fetch('ios.deploymentTarget')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current_target.nil? || Gem::Version.new(current_target) < Gem::Version.new(minimum_target)
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_target
        end
      end
    end`);
}

module.exports = (config) => withPodfile(config, (mod) => {
  mod.modResults.contents = setPodDeploymentTarget(mod.modResults.contents);
  return mod;
});
module.exports.setPodDeploymentTarget = setPodDeploymentTarget;
