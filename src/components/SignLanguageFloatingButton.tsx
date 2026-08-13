/**
 * The floating button.
 *
 * The SDK's only permanent presence in the host app: a logo-only tab docked to
 * a side edge. It appears when the SDK is enabled and disappears while the
 * player is up — the player carries its own expand and close, so a second
 * affordance for the same thing is clutter.
 *
 * Three rules matter more than the rest:
 *
 * - **Off reads as outlined, on reads as solid**, in both appearances.
 * - **One tap always acts.** A peeked button must not spend the first tap
 *   waking up — it wakes and opens the player in the same gesture. Spending a
 *   tap on waking left users tapping twice with nothing on screen explaining
 *   why the first did nothing.
 * - **The 6 pt threshold is the guard**, not a separate wake-up tap: it is what
 *   keeps a stray edge swipe from opening the player.
 *
 * Order on tap: settle first, then act — acting opens the player, which
 * unmounts this component, so the settle animation must already be running.
 * And the resting place lives **outside** this component for the same reason:
 * a position kept in the button's own state dies with it, which is exactly the
 * v1 bug where dragging it to the left edge and opening the player sent it back
 * to the middle of the right one.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
  type PanResponderGestureState,
  type ViewStyle,
} from 'react-native';
import type {
  FloatingButtonIdleBehavior,
  FloatingButtonPosition,
  Language,
} from '../types';
import { FLOATING_BUTTON, MOTION, SHADOW } from '../core/tokens';
import { useSafeAreaInsets } from '../core/insets';
import { stringsFor } from '../core/strings';

const logoSource = require('../assets/logoHead.png');

const DEFAULT_PRIMARY = '#6750A4';

export type Side = 'left' | 'right';

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * A half-rounded "tab": full radius on the two corners facing away from the
 * edge, square against it.
 */
const radiiForSide = (side: Side | null, radius: number): ViewStyle => {
  switch (side) {
    case 'left':
      return {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderTopRightRadius: radius,
        borderBottomRightRadius: radius,
      };
    case 'right':
      return {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        borderTopLeftRadius: radius,
        borderBottomLeftRadius: radius,
      };
    default:
      // Dragging: a full circle.
      return { borderRadius: radius };
  }
};

export interface SignLanguageFloatingButtonProps {
  /** Whether tap-to-translate mode is currently active. */
  active: boolean;

  /** Called when the button is tapped (not dragged). */
  onPress: () => void;

  /**
   * Reports where the button came to rest, so the placement survives this
   * component being unmounted while the player is open.
   */
  onDock?: (side: Side) => void;

  /** Which edge it should start against. */
  initialSide?: Side;

  /** Language for the screen-reader label. */
  language?: Language;

  /**
   * Primary brand color, the default for the active fill, icon tint and border.
   * @default '#6750A4'
   */
  primaryColor?: string;

  /**
   * @deprecated The button sticks to the left/right edges and starts at the
   * middle of one, so this no longer affects the start.
   */
  position?: FloatingButtonPosition;

  /** @default 'peek' */
  idleBehavior?: FloatingButtonIdleBehavior;

  /** @default 2500 */
  idleDelay?: number;

  /** Diameter of the button. @default 44 */
  size?: number;

  /** Fill while the mode is OFF. @default '#FFFFFF' */
  backgroundColor?: string;
  /** Fill while the mode is ON. @default primaryColor */
  activeBackgroundColor?: string;
  /** Logo tint while OFF. @default primaryColor */
  iconColor?: string;
  /** Logo tint while ON. @default '#FFFFFF' */
  activeIconColor?: string;
  /** Border, drawn only while OFF. @default primaryColor */
  borderColor?: string;
}

export const SignLanguageFloatingButton: React.FC<
  SignLanguageFloatingButtonProps
> = ({
  active,
  onPress,
  onDock,
  initialSide = 'right',
  language = 'tr',
  primaryColor = DEFAULT_PRIMARY,
  idleBehavior = 'peek',
  idleDelay = FLOATING_BUTTON.idleDelayMs,
  size = FLOATING_BUTTON.size,
  backgroundColor = '#FFFFFF',
  activeBackgroundColor,
  iconColor,
  activeIconColor = '#FFFFFF',
  borderColor,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets(width, height);
  const strings = stringsFor(language);

  const fill = active ? activeBackgroundColor ?? primaryColor : backgroundColor;
  const tint = active ? activeIconColor : iconColor ?? primaryColor;
  const resolvedBorder = borderColor ?? primaryColor;

  const bounds = useMemo<Bounds>(() => {
    // The side edges stay flush so the tab hugs them — bar the notch, which is
    // the one thing that reaches into them — and the top and bottom respect the
    // safe area.
    const minX = insets.left;
    const minY = insets.top;
    return {
      minX,
      maxX: Math.max(minX, width - size - insets.right),
      minY,
      maxY: Math.max(minY, height - size - insets.bottom),
    };
  }, [width, height, size, insets]);

  const startAt = useMemo(
    () => ({
      x: initialSide === 'left' ? bounds.minX : bounds.maxX,
      y: (bounds.minY + bounds.maxY) / 2,
    }),
    // Only the first mount's values matter; rotation is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const pan = useRef(new Animated.ValueXY(startAt)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  /**
   * The edge the button rests against. `null` while dragging, which is what
   * turns the tab into a circle.
   */
  const [restingSide, setRestingSide] = useState<Side | null>(initialSide);

  const currentXY = useRef(startAt);
  const restingXY = useRef(startAt);
  const sideRef = useRef<Side>(initialSide);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPeeked = useRef(false);
  // A settle animation completes asynchronously and re-arms the idle timer, so
  // it can fire after unmount unless it checks.
  const mounted = useRef(true);

  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const onDockRef = useRef(onDock);
  onDockRef.current = onDock;
  const idleBehaviorRef = useRef(idleBehavior);
  idleBehaviorRef.current = idleBehavior;
  const idleDelayRef = useRef(idleDelay);
  idleDelayRef.current = idleDelay;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    const id = pan.addListener((value) => {
      currentXY.current = value;
    });
    return () => pan.removeListener(id);
  }, [pan]);

  const clearIdleTimer = () => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  /**
   * After a period of inactivity the button tucks partly off its edge so it
   * stops covering content. This is **not** reported as a placement change: it
   * is a temporary slide-off, not a resting place, and recording it would make
   * the button reappear half off-screen next time.
   */
  const runIdle = () => {
    if (!mounted.current) return;

    isPeeked.current = true;
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(opacity, {
        toValue: FLOATING_BUTTON.idleOpacity,
        duration: 220,
        useNativeDriver: true,
      }),
    ];

    if (idleBehaviorRef.current === 'peek') {
      const hidden = sizeRef.current * FLOATING_BUTTON.peekHiddenFraction;
      const b = boundsRef.current;
      const { y } = restingXY.current;
      animations.push(
        Animated.spring(pan, {
          toValue:
            sideRef.current === 'left'
              ? { x: b.minX - hidden, y }
              : { x: b.maxX + hidden, y },
          useNativeDriver: true,
          friction: 8,
          tension: 50,
        })
      );
    }

    Animated.parallel(animations).start();
  };

  const scheduleIdle = () => {
    clearIdleTimer();
    if (!mounted.current) return;
    if (idleBehaviorRef.current === 'none') return;
    idleTimer.current = setTimeout(runIdle, idleDelayRef.current);
  };

  /** Spring to the nearest edge, keeping the vertical position. */
  const settle = (from: { x: number; y: number }) => {
    const b = boundsRef.current;
    const x = clamp(from.x, b.minX, b.maxX);
    const y = clamp(from.y, b.minY, b.maxY);
    const nextSide: Side =
      x + sizeRef.current / 2 < width / 2 ? 'left' : 'right';
    const target = { x: nextSide === 'left' ? b.minX : b.maxX, y };

    restingXY.current = target;
    isPeeked.current = false;
    setRestingSide(nextSide);

    if (sideRef.current !== nextSide) {
      sideRef.current = nextSide;
      // Every resting position reports the new placement to the integration
      // layer, which owns it.
      onDockRef.current?.(nextSide);
    }

    Animated.parallel([
      // The slight overshoot is what makes it read as a snap.
      Animated.spring(pan, {
        toValue: target,
        useNativeDriver: true,
        friction: 7,
        tension: 60,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(scheduleIdle);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > FLOATING_BUTTON.tapSlop ||
          Math.abs(gesture.dy) > FLOATING_BUTTON.tapSlop,
        onPanResponderGrant: () => {
          // Wake to full opacity, but keep the docked shape: switching to a
          // circle here would flash on every plain tap.
          clearIdleTimer();
          pan.stopAnimation();
          opacity.stopAnimation();
          opacity.setValue(1);
          pan.extractOffset();
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
          // Past the slop this is a drag, not a tap, so the tab lifts off its
          // edge and becomes a circle.
          listener: ((_event: unknown, gesture: PanResponderGestureState) => {
            if (
              Math.abs(gesture.dx) > FLOATING_BUTTON.tapSlop ||
              Math.abs(gesture.dy) > FLOATING_BUTTON.tapSlop
            ) {
              setRestingSide(null);
            }
          }) as never,
        }),
        onPanResponderRelease: (_event, gesture) => {
          pan.flattenOffset();

          const isTap =
            Math.abs(gesture.dx) <= FLOATING_BUTTON.tapSlop &&
            Math.abs(gesture.dy) <= FLOATING_BUTTON.tapSlop;

          if (isTap) {
            // Settle first, then act — even from a peeked state. One tap always
            // acts; it is never spent on waking up.
            settle(restingXY.current);
            onPressRef.current();
            return;
          }

          settle(currentXY.current);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pan, opacity, width, height, size]
  );

  // Keep the button on screen through rotation and size changes.
  useEffect(() => {
    clearIdleTimer();
    settle(currentXY.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, size]);

  useEffect(() => {
    mounted.current = true;
    scheduleIdle();
    return () => {
      mounted.current = false;
      clearIdleTimer();
      pan.stopAnimation();
      opacity.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // Full-screen, non-blocking overlay; only the button captures touches.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.container,
          {
            opacity,
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          // Localized, so a screen reader can say whether translation mode is
          // on. The v1 hardcoded Turkish label was a bug.
          accessibilityLabel={strings.translationModeLabel}
          style={[
            styles.button,
            radiiForSide(restingSide, size / 2),
            {
              width: size,
              height: size,
              backgroundColor: fill,
              borderColor: resolvedBorder,
              // Off reads as outlined, on reads as solid.
              borderWidth: active ? 0 : FLOATING_BUTTON.borderWidth,
            },
          ]}
        >
          <Image
            source={logoSource}
            resizeMode="contain"
            style={{
              width: size * FLOATING_BUTTON.logoFraction,
              height: size * FLOATING_BUTTON.logoFraction,
              tintColor: tint,
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.pill,
  },
});

/** Re-exported so the provider can talk about the same motion budget. */
export const FLOATING_BUTTON_SNAP_MS = MOTION.snapTransitionMs;
