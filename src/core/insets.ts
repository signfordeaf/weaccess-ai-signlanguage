/**
 * Safe-area insets, without a `react-native-safe-area-context` dependency.
 *
 * Every floating surface the SDK draws — the player, the button — has to stay
 * inside the part of the screen the user can actually see and touch. What is
 * left of the screen after the status bar, the notch, the navigation bar and
 * the home indicator is not something JavaScript can compute:
 *
 *  - on iOS the inset depends on the device's shape, not its size;
 *  - on Android it depends on whether the window is edge-to-edge, which is the
 *    default from targetSdk 35 and the opposite before it.
 *
 * So the native module is asked, and the estimate below is the fallback for
 * builds that do not have it (the SDK works without the native module by
 * design) and for the frames before the answer arrives.
 */

import { useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';

import NativeSignLanguage from '../NativeSignLanguage';
import type { NativeInsets } from '../NativeSignLanguage';

export type Insets = NativeInsets;

/**
 * Android's gesture navigation bar, as a floor for the estimate.
 *
 * Three-button navigation is taller (48 dp), but this value is only ever used
 * until the native module answers with the real one, and over-reserving on the
 * first frames would visibly shift the player.
 */
const ANDROID_GESTURE_BAR = 24;

/** Devices with a notch or an island; the shortest side is never this long. */
const NOTCHED_MIN_DIMENSION = 812;

/**
 * The estimate.
 *
 * Android's status bar height is a real number the platform reports; the rest
 * are the standard iOS values for a notched and a pre-notch device. The bottom
 * is deliberately *not* zero on Android any more: an edge-to-edge window (the
 * default since targetSdk 35) puts the gesture bar over the app's own layout,
 * and a surface flush with the window bottom lands under it.
 */
export const estimateInsets = (width: number, height: number): Insets => {
  if (Platform.OS === 'android') {
    return {
      top: StatusBar.currentHeight ?? 0,
      bottom: ANDROID_GESTURE_BAR,
      left: 0,
      right: 0,
    };
  }
  const notched = Math.max(width, height) >= NOTCHED_MIN_DIMENSION;
  return {
    top: notched ? 47 : 20,
    bottom: notched ? 34 : 0,
    left: 0,
    right: 0,
  };
};

const isInsets = (value: unknown): value is Insets =>
  !!value &&
  typeof value === 'object' &&
  ['top', 'bottom', 'left', 'right'].every((key) => {
    const entry = (value as Record<string, unknown>)[key];
    return typeof entry === 'number' && Number.isFinite(entry) && entry >= 0;
  });

/**
 * The insets for the current window, refreshed whenever it changes size.
 *
 * Starts at the estimate so the first frame is drawn in a sane place, then
 * settles on the platform's own numbers. Rotation and split-screen change the
 * window's dimensions, which is exactly when the insets move too.
 */
export const useSafeAreaInsets = (width: number, height: number): Insets => {
  const [insets, setInsets] = useState<Insets>(() =>
    estimateInsets(width, height)
  );

  useEffect(() => {
    let cancelled = false;
    const estimate = estimateInsets(width, height);
    setInsets(estimate);

    // Optional twice over: an older native module has no such method, and a
    // host's own mock may not have the module at all.
    const query = NativeSignLanguage?.getSafeAreaInsets;
    if (!query) return;

    Promise.resolve(query.call(NativeSignLanguage))
      .then((native) => {
        if (cancelled || !isInsets(native)) return;
        setInsets(native);
      })
      // A module that predates this method rejects rather than resolves; the
      // estimate already in place is the answer in that case.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [width, height]);

  return insets;
};
