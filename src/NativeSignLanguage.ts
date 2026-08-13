/**
 * The native bridge.
 *
 * In v2 the native side does exactly one thing: put a **"Sign Language" item in
 * the text-selection menu** of text the host app already made selectable, and
 * report back what the user selected. Everything else — the player, the state
 * machine, the API calls, segmentation, the sensitive-data guard, tap
 * classification — is TypeScript, shared by both platforms.
 *
 * That is why this file is small, and why every call is optional: a JS-only
 * consumer that has not rebuilt its native project still gets a fully working
 * SDK, minus the selection menu.
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'weaccess-ai-signlanguage' native module is not linked.\n` +
  Platform.select({
    ios: "Run 'pod install' in your ios/ directory.\n",
    default: '',
  }) +
  'Rebuild the app after installing. The SDK works without it; only the\n' +
  '"Sign Language" text-selection menu item is unavailable.';

/** System-bar / notch insets in dp (Android) or points (iOS). */
export interface NativeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SignLanguageNativeModule {
  /** Language code, so the menu item's title is localized. */
  configure(language: string): void;
  /** Whether the menu item is offered at all. */
  setEnabled(enabled: boolean): void;
  /** Opt a specific view into selection handling. */
  enableTextSelectionForView(viewTag: number): void;
  /**
   * How much of the window the system bars cover. Resolves `null` when the
   * platform cannot answer yet — there is no window, or the module is the
   * JS-only stand-in — and the caller keeps its own estimate.
   */
  getSafeAreaInsets?(): Promise<NativeInsets | null>;
  addListener(eventType: string): void;
  removeListeners(count: number): void;
}

const native = NativeModules.SignLanguageTranslation as
  | SignLanguageNativeModule
  | undefined;

/** Whether the native module is present in this build. */
export const isNativeAvailable = (): boolean => native != null;

let warned = false;
const warnOnce = () => {
  if (__DEV__ && !warned) {
    warned = true;
    console.warn(`[SignLanguage] ${LINKING_ERROR}`);
  }
};

/**
 * A no-op stand-in used when the native module is absent, so callers never have
 * to null-check.
 */
const NOOP: SignLanguageNativeModule = {
  configure: warnOnce,
  setEnabled: warnOnce,
  enableTextSelectionForView: warnOnce,
  // Not a missing feature to warn about: a build without the native module
  // falls back to estimated insets and stays inside the screen either way.
  getSafeAreaInsets: () => Promise.resolve(null),
  addListener: () => {},
  removeListeners: () => {},
};

export const NativeSignLanguage: SignLanguageNativeModule = native ?? NOOP;

/** Fires when the user picks "Sign Language" from a selection menu. */
export const SELECTION_EVENT = 'onTextSelected';

export const nativeEmitter = native
  ? new NativeEventEmitter(native as never)
  : null;

/** Subscribe to selection-menu choices. Returns an unsubscribe function. */
export const onNativeTextSelected = (
  listener: (text: string) => void
): (() => void) => {
  if (!nativeEmitter) return () => {};

  const subscription = nativeEmitter.addListener(
    SELECTION_EVENT,
    (payload: { text?: string }) => {
      if (payload?.text) listener(payload.text);
    }
  );
  return () => subscription.remove();
};

export default NativeSignLanguage;
