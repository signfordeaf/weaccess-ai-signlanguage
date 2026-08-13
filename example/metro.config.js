const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Path to the local SDK package
const sdkPath = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sdkPath],
  resolver: {
    // Block react-native from parent to avoid duplicates
    blockList: [
      new RegExp(`${sdkPath}/node_modules/react-native/.*`),
      new RegExp(`${sdkPath}/node_modules/react/.*`),
      new RegExp(`${sdkPath}/TestApp/.*`),
    ],
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Ensure Metro can resolve the SDK package
    extraNodeModules: {
      'weaccess-ai-signlanguage': sdkPath,
      // Redirect react-native to local node_modules
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
      react: path.resolve(__dirname, 'node_modules/react'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
