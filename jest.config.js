module.exports = {
  preset: 'react-native',
  modulePathIgnorePatterns: [
    '<rootDir>/example/node_modules',
    '<rootDir>/lib/',
  ],
  // Only `*.test.*` files are suites, so shared fixtures can live alongside
  // them in `__tests__/` without Jest demanding they contain a test.
  testMatch: ['**/*.test.{ts,tsx,js,jsx}'],
  testPathIgnorePatterns: [
    '<rootDir>/example/',
    '<rootDir>/TestApp/',
    '<rootDir>/node_modules/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
