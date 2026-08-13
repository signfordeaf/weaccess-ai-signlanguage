/**
 * The hook form of the SDK surface.
 *
 * In v1 this duplicated the provider's logic over the native module, with its
 * own event emitter and its own copy of the state. In v2 it is a thin read of
 * the controller, so the two can no longer disagree about whether a translation
 * is in flight.
 *
 * Its exported shape is unchanged — including the `bottomSheet` names, which
 * now mean "the player" — so an existing integration does not have to change a
 * line.
 */

import { useCallback, useEffect } from 'react';
import { useSignLanguageContext } from './SignLanguageProvider';
import type {
  SignLanguageError,
  SignLanguageEvent,
  SignLanguageEventType,
} from './types';

export interface UseSignLanguageOptions {
  /**
   * Whether to turn the SDK on at mount.
   * @default true
   */
  autoEnable?: boolean;

  /** Called when text is captured, whichever way it reached the SDK. */
  onTextSelected?: (text: string) => void;

  /** Called when a translation finishes and starts playing. */
  onTranslationComplete?: (data: { text: string; videoUrl: string }) => void;

  /** Called on any translation error, cancellation included. */
  onError?: (error: SignLanguageError) => void;

  /**
   * Called when the player opens.
   * @deprecated Named for the v1 bottom sheet.
   */
  onBottomSheetOpen?: () => void;

  /**
   * Called when the player closes.
   * @deprecated Named for the v1 bottom sheet.
   */
  onBottomSheetClose?: () => void;
}

export interface UseSignLanguageReturn {
  isEnabled: boolean;
  isLoading: boolean;
  /** Whether the player is showing. */
  isBottomSheetVisible: boolean;
  error: SignLanguageError | null;
  currentText: string | null;

  enable: () => void;
  disable: () => void;
  translate: (text: string) => Promise<void>;
  /** @deprecated Prefer `closePlayer` from the context. */
  dismissBottomSheet: () => void;
  cancelTranslation: () => void;
  clearError: () => void;

  addEventListener: (
    type: SignLanguageEventType,
    callback: (event: SignLanguageEvent) => void
  ) => () => void;
}

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

  const context = useSignLanguageContext();
  const { controller, state } = context;

  useEffect(() => {
    if (autoEnable) context.enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnable]);

  useEffect(() => {
    if (!onTextSelected) return;
    return controller.events.on('textSelected', (event) => {
      if (event.text) onTextSelected(event.text);
    });
  }, [controller, onTextSelected]);

  useEffect(() => {
    if (!onTranslationComplete) return;
    return controller.events.on('translationComplete', (event) => {
      if (event.text && event.videoUrl) {
        onTranslationComplete({ text: event.text, videoUrl: event.videoUrl });
      }
    });
  }, [controller, onTranslationComplete]);

  useEffect(() => {
    if (!onError) return;
    return controller.events.on('translationError', (event) => {
      if (event.error) onError(event.error);
    });
  }, [controller, onError]);

  useEffect(() => {
    if (!onBottomSheetOpen) return;
    return controller.events.on('panelOpen', () => onBottomSheetOpen());
  }, [controller, onBottomSheetOpen]);

  useEffect(() => {
    if (!onBottomSheetClose) return;
    return controller.events.on('panelClose', () => onBottomSheetClose());
  }, [controller, onBottomSheetClose]);

  const translate = useCallback(
    (text: string) => context.translate(text),
    [context]
  );

  return {
    isEnabled: state.isEnabled,
    isLoading: state.isLoading,
    isBottomSheetVisible: state.isBottomSheetVisible,
    error: state.error ?? null,
    currentText: state.currentText ?? null,

    enable: context.enable,
    disable: context.disable,
    translate,
    dismissBottomSheet: context.dismissBottomSheet,
    cancelTranslation: context.cancelTranslation,
    clearError: context.clearError,
    addEventListener: context.addEventListener,
  };
};
