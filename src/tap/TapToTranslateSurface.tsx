/**
 * The tap-to-translate surface.
 *
 * One view wrapping the host app, answering `onStartShouldSetResponderCapture`.
 * **Returning `false` from that handler is the decline**: the
 * SDK is then not in the responder path at all, and the host's own recogniser
 * owns the pointer from the first event. Claiming and then ignoring is the v1
 * design, and it is why users had to keep toggling the mode off to press
 * anything.
 *
 * Two structural rules this file exists to honour:
 *
 * - **The wrapper's element identity never changes.** Handlers come from a ref
 *   and are built once. A wrapper that remounted on a tap-mode toggle would
 *   reset the host app's navigation stack.
 * - **Scrolling always passes through.** The SDK claims taps only, never drags:
 *   the move handlers always decline, termination is always granted, and
 *   becoming the responder on touch-down does not block native scrolling
 *   because `onResponderGrant` never returns `true`.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Keyboard, View, type LayoutChangeEvent } from 'react-native';
import type { SignController } from '../controller/controller';
import { segmentTexts } from '../core/sentenceSplitter';
import { getTargetFiber, type Fiber } from './fiber';
import { segmentIndexAtPoint } from './charOffset';
import { linesFromProps, patchGlobalText } from './patchText';
import { makeIsAmbient, MeasureCache } from './measure';
import { classify, classifyLegacy, type TapOutcome } from './probe';
import { findLongPressTarget, LONG_PRESS_MS } from './longPress';
import { setTapModeOn } from './textLayoutStore';

/** Past this much travel a touch is a drag, not a tap. */
const TAP_SLOP = 8;

interface SurfaceState {
  area?: { width: number; height: number };
  keyboardVisible: boolean;
  outcome: TapOutcome | null;
  downX: number;
  downY: number;
  locationX: number;
  locationY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  longPressText: string | null;
}

export interface TapToTranslateSurfaceProps {
  controller: SignController;
  children: React.ReactNode;
}

export const TapToTranslateSurface: React.FC<TapToTranslateSurfaceProps> = ({
  controller,
  children,
}) => {
  const state = useRef<SurfaceState>({
    keyboardVisible: false,
    outcome: null,
    downX: 0,
    downY: 0,
    locationX: 0,
    locationY: 0,
    longPressTimer: null,
    longPressText: null,
  }).current;

  const measureCache = useRef(new MeasureCache()).current;
  const isAmbient = useMemo(() => makeIsAmbient(measureCache), [measureCache]);

  // Install the Text patch once. Its absence costs only sentence precision, so
  // a failure warns in development and is otherwise ignored.
  useEffect(() => {
    const result = patchGlobalText();
    if (__DEV__ && result === 'unavailable') {
      console.warn(
        '[SignLanguage] Could not extend the React Native Text export. ' +
          'Tap-to-translate still works; taps will translate the whole ' +
          'paragraph rather than the sentence under the finger.'
      );
    }
  }, []);

  // The patched Text only records geometry while the mode is on.
  useEffect(() => {
    const sync = () => setTapModeOn(controller.tapModeActive);
    sync();
    const unsubscribe = controller.subscribe(sync);
    return () => {
      unsubscribe();
      setTapModeOn(false);
    };
  }, [controller]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      state.keyboardVisible = true;
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      state.keyboardVisible = false;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [state]);

  useEffect(
    () => () => {
      if (state.longPressTimer) clearTimeout(state.longPressTimer);
      measureCache.clear();
    },
    [state, measureCache]
  );

  /** Translate what a classification found, picking the sentence if it can. */
  const commit = (outcome: TapOutcome, x: number, y: number): void => {
    const { fiber, text } = outcome;
    if (!fiber || !text) return;

    const ranges = controller.rangesFor(text);
    const segments = segmentTexts(text, ranges).filter(Boolean);
    if (!segments.length) return;

    const lines = linesFromProps(fiber.memoizedProps);
    const index = lines ? segmentIndexAtPoint(text, ranges, lines, x, y) : -1;

    // Not found means the caller falls back to the whole paragraph, which is
    // exactly the v1 behavior.
    void controller.translateSegments(segments, index >= 0 ? index : 0);
  };

  const cancelLongPress = (): void => {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    state.longPressText = null;
  };

  // Built once: the wrapper's identity must survive every tap-mode toggle.
  const handlers = useMemo(
    () => ({
      onLayout: (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        state.area = { width, height };
      },

      onStartShouldSetResponderCapture: (event: unknown): boolean => {
        state.outcome = null;

        // Collapsing the player hands every tap back. So does closing it.
        if (!controller.tapModeActive) return false;

        const target = getTargetFiber(event);
        // Fail open: never claim a touch we could not classify.
        if (!target) return false;

        const native = (event as { nativeEvent: Record<string, number> })
          .nativeEvent;
        state.downX = native.pageX ?? 0;
        state.downY = native.pageY ?? 0;
        state.locationX = native.locationX ?? 0;
        state.locationY = native.locationY ?? 0;

        const outcome = controller.config.smartPassthrough
          ? classify(target as Fiber, {
              area: state.area,
              keyboardVisible: state.keyboardVisible,
              isAmbient,
            })
          : classifyLegacy(target as Fiber);

        state.outcome = outcome;
        return outcome.kind === 'text';
      },

      // The SDK claims taps only, never drags.
      onMoveShouldSetResponderCapture: () => false,
      onMoveShouldSetResponder: () => false,
      // Always yield to the scroller.
      onResponderTerminationRequest: () => true,
      onResponderTerminate: () => {
        state.outcome = null;
      },

      onResponderGrant: () => {
        // A claimed tap owns the gesture; long press has nothing to add.
        cancelLongPress();
      },

      onResponderMove: (event: unknown) => {
        const native = (event as { nativeEvent: Record<string, number> })
          .nativeEvent;
        const dx = (native.pageX ?? 0) - state.downX;
        const dy = (native.pageY ?? 0) - state.downY;
        if (Math.hypot(dx, dy) > TAP_SLOP) state.outcome = null;
      },

      onResponderRelease: (event: unknown) => {
        const outcome = state.outcome;
        state.outcome = null;
        if (!outcome) return;

        const native = (event as { nativeEvent: Record<string, number> })
          .nativeEvent;
        const dx = (native.pageX ?? 0) - state.downX;
        const dy = (native.pageY ?? 0) - state.downY;
        if (Math.hypot(dx, dy) > TAP_SLOP) return;

        commit(outcome, state.locationX, state.locationY);
      },

      // Long press: observed, never claimed.
      onTouchStartCapture: (event: unknown) => {
        cancelLongPress();

        const config = controller.config;
        if (!config.longPressToTranslate) return;
        // Only while the player is open *and* expanded: collapsed, this would
        // translate into a stage nobody can see.
        if (!controller.tapModeActive) return;
        // The tap path already owns this touch.
        if (state.outcome?.kind === 'text') return;

        const target = getTargetFiber(event);
        if (!target) return;

        const found = findLongPressTarget(target as Fiber, (fiber) =>
          isAmbient(fiber, { area: state.area })
        );
        if (!found) return;

        state.longPressText = found.text;
        state.longPressTimer = setTimeout(() => {
          state.longPressTimer = null;
          const text = state.longPressText;
          state.longPressText = null;
          if (text) void controller.translate(text);
        }, LONG_PRESS_MS);
      },

      onTouchMove: (event: unknown) => {
        if (!state.longPressTimer) return;
        const native = (event as { nativeEvent: Record<string, number> })
          .nativeEvent;
        const dx = (native.pageX ?? 0) - state.downX;
        const dy = (native.pageY ?? 0) - state.downY;
        if (Math.hypot(dx, dy) > TAP_SLOP) cancelLongPress();
      },

      onTouchEnd: cancelLongPress,
      onTouchCancel: cancelLongPress,
    }),
    // Everything mutable is read through refs, so these never need rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <View style={{ flex: 1 }} collapsable={false} {...handlers}>
      {children}
    </View>
  );
};
