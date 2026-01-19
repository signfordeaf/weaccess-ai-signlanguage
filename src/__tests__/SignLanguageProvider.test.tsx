// src/__tests__/SignLanguageProvider.test.tsx

import React from 'react';
import {Text} from 'react-native';

// Mock the native module
jest.mock('../NativeSignLanguage', () => ({
  __esModule: true,
  default: {
    configure: jest.fn().mockResolvedValue(undefined),
    enable: jest.fn(),
    disable: jest.fn(),
    isEnabled: jest.fn().mockResolvedValue(false),
    translateText: jest.fn().mockResolvedValue({videoUrl: 'https://example.com/video.mp4'}),
    showBottomSheet: jest.fn().mockResolvedValue(undefined),
    dismissBottomSheet: jest.fn(),
    cancelTranslation: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
  signLanguageEmitter: {
    addListener: jest.fn().mockReturnValue({remove: jest.fn()}),
    removeAllListeners: jest.fn(),
  },
}));

describe('SignLanguageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    const {SignLanguageProvider} = require('../SignLanguageProvider');
    expect(SignLanguageProvider).toBeDefined();
  });

  it('should render children', () => {
    const {SignLanguageProvider} = require('../SignLanguageProvider');
    const {render} = require('@testing-library/react-native');

    const {getByText} = render(
      <SignLanguageProvider>
        <Text>Test Child</Text>
      </SignLanguageProvider>
    );

    expect(getByText('Test Child')).toBeDefined();
  });
});

describe('useSignLanguage', () => {
  it('should be defined', () => {
    const {useSignLanguage} = require('../useSignLanguage');
    expect(useSignLanguage).toBeDefined();
  });
});

describe('Types', () => {
  it('should export SignLanguageConfig type', () => {
    const types = require('../types');
    expect(types).toBeDefined();
  });
});

describe('Constants', () => {
  it('should export SUPPORTED_LANGUAGES', () => {
    const {SUPPORTED_LANGUAGES} = require('../constants');
    expect(SUPPORTED_LANGUAGES).toBeDefined();
    expect(SUPPORTED_LANGUAGES.TURKISH).toBe('tr');
    expect(SUPPORTED_LANGUAGES.ENGLISH).toBe('en');
    expect(SUPPORTED_LANGUAGES.ARABIC).toBe('ar');
  });

  it('should export DEFAULT_CONFIG', () => {
    const {DEFAULT_CONFIG} = require('../constants');
    expect(DEFAULT_CONFIG).toBeDefined();
    expect(DEFAULT_CONFIG.language).toBe('tr');
  });
});
