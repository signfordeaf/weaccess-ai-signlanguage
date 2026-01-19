// Main Entry Point
export { SignLanguageProvider, useSignLanguageContext } from './SignLanguageProvider';
export type { SignLanguageProviderProps, SignLanguageContextValue } from './SignLanguageProvider';

export { useSignLanguage } from './useSignLanguage';
export type { UseSignLanguageOptions, UseSignLanguageReturn } from './useSignLanguage';

export { SignLanguageText } from './components/SignLanguageText';
export { SignLanguageView } from './components/SignLanguageView';

// Selectable Text Components - NEW!
export { 
  SelectableTextProvider,
  Text,
  enableGlobalSelectableText,
  useSelectableText,
} from './components/SelectableTextProvider';

// Types
export type {
  SignLanguageConfig,
  SignLanguageTheme,
  SignLanguageState,
  SignLanguageError,
  SignLanguageEvent,
  SignLanguageEventType,
  AccessibilityConfig,
  Language,
} from './types';

// Native Module (for advanced usage)
export { default as NativeSignLanguage } from './NativeSignLanguage';

// Constants
export { SUPPORTED_LANGUAGES, DEFAULT_THEME } from './constants';
