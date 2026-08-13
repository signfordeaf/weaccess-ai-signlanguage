const path = require('path');

module.exports = {
  preset: 'react-native',
  // The SDK is consumed from ../src, which would otherwise pull the *root*
  // node_modules copy of React Native — a second, unmocked instance. Pin both
  // to the example's own copies so the preset's mocks actually apply.
  moduleNameMapper: {
    '^react-native$': path.resolve(__dirname, 'node_modules/react-native'),
    '^react$': path.resolve(__dirname, 'node_modules/react'),
  },
};
