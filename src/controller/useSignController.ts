/**
 * The React binding for the controller.
 *
 * The controller itself is plain TypeScript; this is the only place that knows
 * about React. Views subscribe to the slices they actually use, so a caption
 * re-render does not drag the whole player with it.
 */

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SignController, ControllerState } from './controller';

export const SignControllerContext = createContext<SignController | null>(null);

/**
 * The controller for the nearest provider.
 *
 * Returns `null` outside a provider rather than throwing, so an SDK component
 * rendered by mistake degrades to nothing instead of crashing the host app.
 */
export const useOptionalController = (): SignController | null =>
  useContext(SignControllerContext);

export const useController = (): SignController => {
  const controller = useContext(SignControllerContext);
  if (!controller) {
    throw new Error(
      'SignLanguage components must be rendered inside a <SignLanguageProvider>.'
    );
  }
  return controller;
};

/**
 * Subscribe to a slice of controller state.
 *
 * `selector` must return a value comparable with `Object.is` — a primitive, or
 * a stable reference. Returning a fresh object every call re-renders on every
 * notification.
 */
export function useControllerSelector<T>(
  controller: SignController,
  selector: (state: ControllerState) => T
): T {
  return useSyncExternalStore(
    controller.subscribe,
    () => selector(controller.getState()),
    () => selector(controller.getState())
  );
}

/** The whole controller state. Re-renders on every change. */
export const useControllerState = (
  controller: SignController
): ControllerState =>
  useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );
