// The single ESLint config for the package. `package.json` used to carry a
// second, conflicting `eslintConfig` block; this file wins, so the two only
// ever disagreed silently.
module.exports = {
  root: true,
  extends: ['@react-native-community', 'prettier'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['lib/', 'node_modules/', 'example/', 'TestApp/'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-shadow': ['error'],
        'no-shadow': 'off',
        'no-undef': 'off',
      },
    },
  ],
  rules: {
    'react-native/no-inline-styles': 'off',
    // `void somePromise()` is how this codebase marks a promise it
    // deliberately does not await — a prefetch, a preference write. Allowed as
    // a statement only, so it cannot hide a real value.
    'no-void': ['error', { allowAsStatement: true }],
  },
};
