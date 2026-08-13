import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { SignController, type DockSide } from './controller/controller';
import {
  SignControllerContext,
  useControllerState,
} from './controller/useSignController';
import { SignPlayer } from './views/SignPlayer';
import { SignLanguageFloatingButton } from './components/SignLanguageFloatingButton';
import { TapToTranslateSurface } from './tap/TapToTranslateSurface';
import NativeSignLanguage, { onNativeTextSelected } from './NativeSignLanguage';
import type {
  SignLanguageConfig,
  SignLanguageError,
  SignLanguageEvent,
  SignLanguageEventType,
  SignLanguageState,
} from './types';

/**
 * Context value interface.
 *
 * Every v1 member is still here and still means what it did: the v1 entry points
 * and their parameters survive v2 unchanged. The v2 surface is additive.
 */
export interface SignLanguageContextValue {
  /** Current state of the SDK. */
  state: SignLanguageState;

  /** Update configuration. */
  configure: (config: SignLanguageConfig) => Promise<void>;

  /** Enable text selection and sign language translation. */
  enable: () => void;

  /** Disable text selection and sign language translation. */
  disable: () => void;

  /** Whether tap-to-translate mode is currently active. */
  isTapToTranslateActive: boolean;

  /** Toggle tap-to-translate mode, opening or closing the player with it. */
  toggleTapToTranslate: () => void;

  /** Programmatically translate text. */
  translate: (text: string) => Promise<void>;

  /**
   * Dismiss the player.
   * @deprecated Named for the v1 bottom sheet. Prefer `closePlayer`.
   */
  dismissBottomSheet: () => void;

  /** Close the player. */
  closePlayer: () => void;

  /** Collapse or expand the player. */
  toggleCollapsed: () => void;

  /** Cancel an ongoing translation. */
  cancelTranslation: () => void;

  /** Clear the current error. */
  clearError: () => void;

  /** Add an event listener. Accepts both the v1 and the v2 event names. */
  addEventListener: (
    type: SignLanguageEventType,
    callback: (event: SignLanguageEvent) => void
  ) => () => void;

  /** The controller, for hosts that want to drive the SDK from their own UI. */
  controller: SignController;
}

const SignLanguageContext = createContext<SignLanguageContextValue | null>(
  null
);

export interface SignLanguageProviderProps {
  children: ReactNode;

  /** Configuration. Optional — it can be supplied later via `configure()`. */
  config?: SignLanguageConfig;

  /** Called once the SDK is configured. */
  onReady?: () => void;

  /** Called on any error. */
  onError?: (error: SignLanguageError) => void;

  /**
   * Whether to turn the SDK on at mount.
   *
   * The SDK is off by default; this provider keeps the v1 default
   * of `true` so existing integrations behave as they did.
   */
  autoEnable?: boolean;

  /** Forwarded the whole event stream. */
  onEvent?: (event: SignLanguageEvent) => void;

  /** Supply a controller instead of letting the provider create one. */
  controller?: SignController;
}

/**
 * Mounts the SDK above the host app.
 *
 * Three independent layers, bottom to top: the app wrapped in the tap detector,
 * the floating button, and the player. Each rebuilds on controller changes
 * without rebuilding the app subtree.
 *
 * @example
 * ```tsx
 * <SignLanguageProvider
 *   config={{ apiKey: 'YOUR_API_KEY', apiUrl: 'https://api.signfordeaf.com' }}
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
  onEvent,
  controller: suppliedController,
}) => {
  // Created once. A controller that changed identity would take the whole
  // translation state with it.
  const ownControllerRef = useRef<SignController | null>(null);
  if (!ownControllerRef.current && !suppliedController) {
    ownControllerRef.current = new SignController();
  }
  const controller = suppliedController ?? ownControllerRef.current!;

  const state = useControllerState(controller);

  // Configuration is applied before the first frame, so the SDK never flashes
  // default colors or the wrong language.
  const configuredRef = useRef(false);
  if (!configuredRef.current && config?.apiKey) {
    configuredRef.current = true;
    controller.configure(config, config.storage);
    if (autoEnable) controller.enable();
  }

  // Re-apply when the credentials or language actually change.
  useEffect(() => {
    if (!config?.apiKey) return;
    controller.configure(config, config.storage);
    onReady?.();
    if (autoEnable) controller.enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.apiKey, config?.apiUrl, config?.language, autoEnable]);

  useEffect(() => {
    if (!onError) return;
    return controller.events.on('translationError', (event) => {
      if (event.error) onError(event.error);
    });
  }, [controller, onError]);

  // The one thing that still comes from native: the "Sign Language" item in the
  // platform's text-selection menu.
  useEffect(() => {
    NativeSignLanguage.configure(controller.config.language);
    NativeSignLanguage.setEnabled(state.enabled);
  }, [controller, state.enabled, controller.config.language]);

  useEffect(
    () =>
      onNativeTextSelected((text) => {
        void controller.translate(text);
      }),
    [controller]
  );

  useEffect(() => {
    if (!onEvent) return;
    return controller.events.onAny((event) =>
      onEvent({
        type: event.type as SignLanguageEventType,
        payload: event,
        timestamp: event.timestamp,
      })
    );
  }, [controller, onEvent]);

  useEffect(() => {
    // Only dispose a controller this provider created.
    const owned = ownControllerRef.current;
    return () => {
      owned?.dispose();
    };
  }, []);

  const legacyState = useMemo<SignLanguageState>(
    () => ({
      isConfigured: !!controller.config.apiKey,
      isEnabled: state.enabled,
      isLoading: state.translationState === 'loading',
      // Named for the v1 bottom sheet; it means "the player is showing".
      isBottomSheetVisible: controller.playerVisible,
      currentText: state.currentText,
      error: state.error,
    }),
    [
      controller,
      state.enabled,
      state.translationState,
      state.currentText,
      state.error,
    ]
  );

  const contextValue = useMemo<SignLanguageContextValue>(
    () => ({
      state: legacyState,
      configure: async (next) => {
        controller.configure(next, next.storage);
      },
      enable: () => controller.enable(),
      disable: () => controller.disable(),
      isTapToTranslateActive: controller.tapModeActive,
      toggleTapToTranslate: () => controller.toggleTapMode(),
      translate: (text) => controller.translate(text),
      dismissBottomSheet: () => controller.close(),
      closePlayer: () => controller.close(),
      toggleCollapsed: () => controller.toggleCollapsed(),
      cancelTranslation: () => controller.cancel(),
      clearError: () => controller.clearError(),
      addEventListener: (type, callback) =>
        controller.events.on(type, (event) =>
          callback({
            type: event.type as SignLanguageEventType,
            payload: event,
            timestamp: event.timestamp,
          })
        ),
      controller,
    }),
    [controller, legacyState]
  );

  // Shown only when the SDK is enabled, the button is enabled, and the player
  // is *not* visible.
  const showButton =
    state.enabled &&
    controller.config.floatingButton.enabled !== false &&
    !controller.playerVisible;

  const button = controller.config.floatingButton;

  return (
    <SignLanguageContext.Provider value={contextValue}>
      <SignControllerContext.Provider value={controller}>
        <View style={{ flex: 1 }}>
          {/* Layer 1: the host app, wrapped in the tap detector. Its element
              identity never changes, so toggling tap mode does not remount the
              app or reset its navigation stack. */}
          <TapToTranslateSurface controller={controller}>
            {children}
          </TapToTranslateSurface>

          {/* Layer 2: the floating button, shown only while the player is
              closed. The player carries its own expand and close, so a second
              affordance for the same thing is clutter. */}
          {showButton ? (
            <SignLanguageFloatingButton
              active={controller.tapModeActive}
              onPress={() => controller.toggleTapMode()}
              onDock={(dockSide: DockSide) => controller.setDockSide(dockSide)}
              initialSide={state.dockSide}
              language={controller.config.language}
              primaryColor={controller.config.theme.primaryColor}
              idleBehavior={button.idleBehavior}
              idleDelay={button.idleDelayMs}
              size={button.size}
              backgroundColor={button.backgroundColor}
              activeBackgroundColor={button.activeBackgroundColor}
              iconColor={button.iconColor}
              activeIconColor={button.activeIconColor}
              borderColor={button.borderColor}
            />
          ) : null}

          {/* Layer 3: the player. */}
          <SignPlayer controller={controller} />
        </View>
      </SignControllerContext.Provider>
    </SignLanguageContext.Provider>
  );
};

/**
 * Access the SDK from anywhere inside a {@link SignLanguageProvider}.
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
