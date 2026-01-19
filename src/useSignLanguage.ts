import { useCallback, useEffect, useState, useRef } from 'react';
import { NativeEventEmitter } from 'react-native';
import NativeSignLanguage from './NativeSignLanguage';
import { EVENT_NAMES } from './constants';
import type { SignLanguageError, SignLanguageEvent, SignLanguageEventType } from './types';

// Event emitter for receiving native events
const eventEmitter = new NativeEventEmitter(NativeSignLanguage as any);

/**
 * Options for the useSignLanguage hook
 */
export interface UseSignLanguageOptions {
  /**
   * Whether to auto-enable text selection on mount
   * @default true
   */
  autoEnable?: boolean;

  /**
   * Callback when text is selected
   */
  onTextSelected?: (text: string) => void;

  /**
   * Callback when translation is complete
   */
  onTranslationComplete?: (data: { text: string; videoUrl: string }) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: SignLanguageError) => void;

  /**
   * Callback when bottom sheet opens
   */
  onBottomSheetOpen?: () => void;

  /**
   * Callback when bottom sheet closes
   */
  onBottomSheetClose?: () => void;
}

/**
 * Return type for useSignLanguage hook
 */
export interface UseSignLanguageReturn {
  /**
   * Whether the SDK is currently enabled
   */
  isEnabled: boolean;

  /**
   * Whether a translation is in progress
   */
  isLoading: boolean;

  /**
   * Whether the bottom sheet is visible
   */
  isBottomSheetVisible: boolean;

  /**
   * Current error if any
   */
  error: SignLanguageError | null;

  /**
   * Currently selected/translated text
   */
  currentText: string | null;

  /**
   * Enable text selection and translation
   */
  enable: () => void;

  /**
   * Disable text selection and translation
   */
  disable: () => void;

  /**
   * Programmatically translate text
   */
  translate: (text: string) => Promise<void>;

  /**
   * Dismiss the bottom sheet
   */
  dismissBottomSheet: () => void;

  /**
   * Cancel ongoing translation
   */
  cancelTranslation: () => void;

  /**
   * Clear the current error
   */
  clearError: () => void;

  /**
   * Add event listener
   */
  addEventListener: (
    type: SignLanguageEventType,
    callback: (event: SignLanguageEvent) => void
  ) => () => void;
}

/**
 * Hook for accessing Sign Language SDK functionality
 *
 * This hook can be used independently or with SignLanguageProvider
 *
 * @example
 * ```tsx
 * const {
 *   isEnabled,
 *   isLoading,
 *   translate,
 *   enable,
 *   disable,
 * } = useSignLanguage({
 *   onTextSelected: (text) => console.log('Selected:', text),
 *   onError: (error) => console.error('Error:', error),
 * });
 *
 * // Programmatic translation
 * await translate('Hello world');
 * ```
 */
export const useSignLanguage = (
  options: UseSignLanguageOptions = {}
): UseSignLanguageReturn => {
  const {
    autoEnable = true,
    onTextSelected,
    onTranslationComplete,
    onError,
    onBottomSheetOpen,
    onBottomSheetClose,
  } = options;

  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const [error, setError] = useState<SignLanguageError | null>(null);
  const [currentText, setCurrentText] = useState<string | null>(null);

  // Use refs for callbacks to avoid re-subscribing
  const callbackRefs = useRef({
    onTextSelected,
    onTranslationComplete,
    onError,
    onBottomSheetOpen,
    onBottomSheetClose,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbackRefs.current = {
      onTextSelected,
      onTranslationComplete,
      onError,
      onBottomSheetOpen,
      onBottomSheetClose,
    };
  }, [onTextSelected, onTranslationComplete, onError, onBottomSheetOpen, onBottomSheetClose]);

  // Subscribe to native events
  useEffect(() => {
    const subscriptions = [
      eventEmitter.addListener(EVENT_NAMES.TEXT_SELECTED, (data: any) => {
        const text = data?.text ?? '';
        setCurrentText(text);
        callbackRefs.current.onTextSelected?.(text);
      }),
      eventEmitter.addListener(EVENT_NAMES.TRANSLATION_START, (data: any) => {
        setIsLoading(true);
        setCurrentText(data?.text ?? null);
        setError(null);
      }),
      eventEmitter.addListener(EVENT_NAMES.TRANSLATION_COMPLETE, (data: any) => {
        setIsLoading(false);
        callbackRefs.current.onTranslationComplete?.({
          text: data?.text ?? '',
          videoUrl: data?.videoUrl ?? '',
        });
      }),
      eventEmitter.addListener(EVENT_NAMES.TRANSLATION_ERROR, (data: any) => {
        const signError: SignLanguageError = {
          code: data?.code ?? 'UNKNOWN',
          message: data?.message ?? 'Unknown error occurred',
        };
        setIsLoading(false);
        setError(signError);
        callbackRefs.current.onError?.(signError);
      }),
      eventEmitter.addListener(EVENT_NAMES.BOTTOM_SHEET_OPEN, () => {
        setIsBottomSheetVisible(true);
        callbackRefs.current.onBottomSheetOpen?.();
      }),
      eventEmitter.addListener(EVENT_NAMES.BOTTOM_SHEET_CLOSE, () => {
        setIsBottomSheetVisible(false);
        callbackRefs.current.onBottomSheetClose?.();
      }),
    ];

    // Auto-enable if configured
    if (autoEnable) {
      NativeSignLanguage.enable();
      setIsEnabled(true);
    }

    return () => {
      subscriptions.forEach((sub) => sub.remove());
      if (autoEnable) {
        NativeSignLanguage.disable();
      }
    };
  }, [autoEnable]);

  // Enable function
  const enable = useCallback(() => {
    NativeSignLanguage.enable();
    setIsEnabled(true);
  }, []);

  // Disable function
  const disable = useCallback(() => {
    NativeSignLanguage.disable();
    setIsEnabled(false);
  }, []);

  // Translate function
  const translate = useCallback(async (text: string) => {
    setIsLoading(true);
    setCurrentText(text);
    setError(null);
    try {
      await NativeSignLanguage.translateText(text);
    } catch (err: any) {
      const signError: SignLanguageError = {
        code: 'API_ERROR',
        message: err?.message ?? 'Translation failed',
      };
      setIsLoading(false);
      setError(signError);
      callbackRefs.current.onError?.(signError);
      throw err;
    }
  }, []);

  // Dismiss bottom sheet
  const dismissBottomSheet = useCallback(() => {
    NativeSignLanguage.dismissBottomSheet();
  }, []);

  // Cancel translation
  const cancelTranslation = useCallback(() => {
    NativeSignLanguage.cancelTranslation();
    setIsLoading(false);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Add event listener
  const addEventListener = useCallback(
    (type: SignLanguageEventType, callback: (event: SignLanguageEvent) => void) => {
      const subscription = eventEmitter.addListener(type, (payload: any) => {
        callback({
          type,
          payload,
          timestamp: Date.now(),
        });
      });
      return () => subscription.remove();
    },
    []
  );

  return {
    isEnabled,
    isLoading,
    isBottomSheetVisible,
    error,
    currentText,
    enable,
    disable,
    translate,
    dismissBottomSheet,
    cancelTranslation,
    clearError,
    addEventListener,
  };
};
