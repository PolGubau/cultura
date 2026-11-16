const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Standalone installs deliberately retain separate React versions. Watch only
// the framework-free shared source, not the other app's node_modules.
config.watchFolders = [require('path').resolve(__dirname, '../shared')];

// Add .avif support — Metro does not include it by default
config.resolver.assetExts.push('avif');

// Remove deprecated watcher option injected by Expo's default config.
// Metro renamed unstable_workerThreads → workerThreads; suppress the warning.
if (config.watcher?.unstable_workerThreads !== undefined) {
  const { unstable_workerThreads, ...rest } = config.watcher;
  config.watcher = rest;
}

module.exports = config;
