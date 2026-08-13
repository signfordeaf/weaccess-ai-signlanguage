// Main entry point.
//
// Every v1 name still works and still means what it did: the v1 entry points
// and their parameters survive v2 unchanged. Everything new is additive.

export {
  SignLanguageProvider,
  useSignLanguageContext,
} from './SignLanguageProvider';
export type {
  SignLanguageProviderProps,
  SignLanguageContextValue,
} from './SignLanguageProvider';

export { useSignLanguage } from './useSignLanguage';
export type {
  UseSignLanguageOptions,
  UseSignLanguageReturn,
} from './useSignLanguage';

// Components
export { SignLanguageText } from './components/SignLanguageText';
export { SignLanguageView } from './components/SignLanguageView';
export { SignLanguageFloatingButton } from './components/SignLanguageFloatingButton';
export type { SignLanguageFloatingButtonProps } from './components/SignLanguageFloatingButton';

export {
  SelectableTextProvider,
  Text,
  enableGlobalSelectableText,
  useSelectableText,
} from './components/SelectableTextProvider';

// The controller, for hosts driving the SDK from their own UI.
export { SignController } from './controller/controller';
export type { ControllerState, DockSide } from './controller/controller';
export {
  useController,
  useOptionalController,
  useControllerState,
  useControllerSelector,
} from './controller/useSignController';

// Mark host content as sensitive, so it is never sent for translation.
export { sensitiveRegistry } from './core/sensitiveDataGuard';
export { SignLanguageSensitive } from './components/SignLanguageSensitive';
export type { SignLanguageSensitiveProps } from './components/SignLanguageSensitive';

// Types
export type {
  SignLanguageConfig,
  SignLanguageTheme,
  SignLanguageCardConfig,
  SignLanguageState,
  SignLanguageError,
  SignLanguageErrorCode,
  SignLanguageEvent,
  SignLanguageEventType,
  SignLanguageStorage,
  AccessibilityConfig,
  Language,
  TranslationState,
  TranslationGranularity,
  TranslatorId,
  CardCorner,
  FloatingButtonConfig,
  FloatingButtonPosition,
  FloatingButtonIdleBehavior,
} from './types';

export type { SignEvent, SignEventType } from './core/events';

// The bundled translators, for hosts that offer their own picker.
export { SIGNERS, ALL_SIGNERS } from './core/signers';
export type { Signer } from './core/signers';

// Constants
export {
  SUPPORTED_LANGUAGES,
  DEFAULT_THEME,
  LOCALIZED_STRINGS,
} from './constants';

// The native module, for advanced usage. In v2 it only carries the
// text-selection menu; everything else is TypeScript.
export {
  default as NativeSignLanguage,
  isNativeAvailable,
  onNativeTextSelected,
} from './NativeSignLanguage';
