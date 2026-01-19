import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { NativeEventEmitter } from 'react-native';
import NativeSignLanguage from './NativeSignLanguage';
import { DEFAULT_THEME, EVENT_NAMES } from './constants';
import type {
  SignLanguageConfig,
  SignLanguageState,
  SignLanguageError,
  SignLanguageEvent,
  SignLanguageEventType,
} from './types';

// Event emitter for receiving native events
const eventEmitter = new NativeEventEmitter(NativeSignLanguage as any);

/**
 * Context value interface
 */
export interface SignLanguageContextValue {
  /**
   * Current state of the SDK
   */
  state: SignLanguageState;

  /**
   * Update configuration
   */
  configure: (config: SignLanguageConfig) => Promise<void>;

  /**
   * Enable text selection and sign language translation
   */
  enable: () => void;

  /**
   * Disable text selection and sign language translation
   */
  disable: () => void;

  /**
   * Programmatically translate text
   */
  translate: (text: string) => Promise<void>;

  /**
   * Dismiss the bottom sheet if visible
   */
  dismissBottomSheet: () => void;

  /**
   * Cancel ongoing translation
   */
  cancelTranslation: () => void;

  /**
   * Add event listener
   */
  addEventListener: (
    type: SignLanguageEventType,
    callback: (event: SignLanguageEvent) => void
  ) => () => void;
}

const SignLanguageContext = createContext<SignLanguageContextValue | null>(null);

/**
 * Props for SignLanguageProvider
 */
export interface SignLanguageProviderProps {
  /**
   * Child components
   */
  children: ReactNode;

  /**
   * Configuration for the Sign Language SDK (optional - can be set later via configure())
   */
  config?: SignLanguageConfig;

  /**
   * Callback when SDK is ready
   */
  onReady?: () => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: SignLanguageError) => void;

  /**
   * Whether to automatically enable text selection on mount
   * @default true
   */
  autoEnable?: boolean;
}

/**
 * Provider component for Sign Language SDK
 *
 * Wrap your app with this provider to enable sign language translation
 *
 * @example
 * ```tsx
 * <SignLanguageProvider
 *   config={{
 *     apiKey: 'YOUR_API_KEY',
 *     apiUrl: 'https://api.signfordeaf.com',
 *     language: 'tr',
 *   }}
 *   onReady={() => console.log('SDK ready')}
 * >
 *   <App />
 * </SignLanguageProvider>
 * ```
 */
export const SignLanguageProvider: React.FC<SignLanguageProviderProps> = ({
  children,
  config,
  onReady,
  onError,
  autoEnable = true,
}) => {
  const [state, setState] = useState<SignLanguageState>({
    isConfigured: false,
    isEnabled: false,
    isLoading: false,
    isBottomSheetVisible: false,
  });

  // Initialize SDK on mount
  useEffect(() => {
    // Skip initialization if no config provided (will be configured manually)
    if (!config?.apiKey) {
      return;
    }

    const initialize = async () => {
      try {
        await NativeSignLanguage.configure(
          config.apiKey,
          config.apiUrl,
          config.language ?? 'tr',
          config.fdid ?? '16',
          config.tid ?? '23',
          { ...DEFAULT_THEME, ...config.theme },
          config.accessibility ?? {}
        );

        setState((prev) => ({ ...prev, isConfigured: true }));
        onReady?.();

        // Auto-enable if configured
        if (autoEnable) {
          NativeSignLanguage.enable();
          setState((prev) => ({ ...prev, isEnabled: true }));
        }
      } catch (error: any) {
        const signError: SignLanguageError = {
          code: 'CONFIGURATION_ERROR',
          message: error?.message ?? 'Failed to configure SDK',
        };
        setState((prev) => ({ ...prev, error: signError }));
        onError?.(signError);
      }
    };

    initialize();
  }, [config?.apiKey, config?.apiUrl, config?.language, autoEnable]);

  // Subscribe to native events
  useEffect(() => {
    const subscriptions = [
      eventEmitter.addListener(EVENT_NAMES.BOTTOM_SHEET_OPEN, () => {
        setState((prev) => ({ ...prev, isBottomSheetVisible: true }));
      }),
      eventEmitter.addListener(EVENT_NAMES.BOTTOM_SHEET_CLOSE, () => {
        setState((prev) => ({ ...prev, isBottomSheetVisible: false }));
      }),
      eventEmitter.addListener(EVENT_NAMES.TRANSLATION_START, (data: any) => {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          currentText: data?.text,
        }));
      }),
      eventEmitter.addListener(EVENT_NAMES.TRANSLATION_COMPLETE, () => {
        setState((prev) => ({ ...prev, isLoading: false }));
      }),
      eventEmitter.addListener(EVENT_NAMES.TRANSLATION_ERROR, (data: any) => {
        const error: SignLanguageError = {
          code: data?.code ?? 'UNKNOWN',
          message: data?.message ?? 'Unknown error occurred',
        };
        setState((prev) => ({ ...prev, isLoading: false, error }));
        onError?.(error);
      }),
    ];

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [onError]);

  // Configure function
  const configure = useCallback(async (newConfig: SignLanguageConfig) => {
    await NativeSignLanguage.configure(
      newConfig.apiKey,
      newConfig.apiUrl,
      newConfig.language ?? 'tr',
      newConfig.fdid ?? '16',
      newConfig.tid ?? '23',
      { ...DEFAULT_THEME, ...newConfig.theme },
      newConfig.accessibility ?? {}
    );
    setState((prev) => ({ ...prev, isConfigured: true }));
  }, []);

  // Enable function
  const enable = useCallback(() => {
    NativeSignLanguage.enable();
    setState((prev) => ({ ...prev, isEnabled: true }));
  }, []);

  // Disable function
  const disable = useCallback(() => {
    NativeSignLanguage.disable();
    setState((prev) => ({ ...prev, isEnabled: false }));
  }, []);

  // Translate function
  const translate = useCallback(async (text: string) => {
    setState((prev) => ({ ...prev, isLoading: true, currentText: text, error: undefined }));
    try {
      await NativeSignLanguage.translateText(text);
    } catch (error: any) {
      const signError: SignLanguageError = {
        code: 'API_ERROR',
        message: error?.message ?? 'Translation failed',
      };
      setState((prev) => ({ ...prev, isLoading: false, error: signError }));
      throw error;
    }
  }, []);

  // Dismiss bottom sheet
  const dismissBottomSheet = useCallback(() => {
    NativeSignLanguage.dismissBottomSheet();
  }, []);

  // Cancel translation
  const cancelTranslation = useCallback(() => {
    NativeSignLanguage.cancelTranslation();
    setState((prev) => ({ ...prev, isLoading: false }));
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

  // Memoize context value
  const contextValue = useMemo<SignLanguageContextValue>(
    () => ({
      state,
      configure,
      enable,
      disable,
      translate,
      dismissBottomSheet,
      cancelTranslation,
      addEventListener,
    }),
    [
      state,
      configure,
      enable,
      disable,
      translate,
      dismissBottomSheet,
      cancelTranslation,
      addEventListener,
    ]
  );

  return (
    <SignLanguageContext.Provider value={contextValue}>
      {children}
    </SignLanguageContext.Provider>
  );
};

/**
 * Hook to access Sign Language SDK context
 *
 * Must be used within a SignLanguageProvider
 *
 * @example
 * ```tsx
 * const { state, translate, enable, disable } = useSignLanguageContext();
 * ```
 */
export const useSignLanguageContext = (): SignLanguageContextValue => {
  const context = useContext(SignLanguageContext);
  if (!context) {
    throw new Error(
      'useSignLanguageContext must be used within a SignLanguageProvider'
    );
  }
  return context;
};
