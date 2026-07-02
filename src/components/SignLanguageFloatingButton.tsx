import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type ViewStyle,
} from 'react-native';
import type {
  FloatingButtonIdleBehavior,
  FloatingButtonPosition,
} from '../types';

const logoSource = require('../assets/logoHead.png');

// Movement (in points) below which a gesture is treated as a tap rather than a drag.
const TAP_MOVEMENT_THRESHOLD = 6;
const DEFAULT_BUTTON_SIZE = 44;
const DEFAULT_PRIMARY = '#6750A4';
const DEFAULT_IDLE_DELAY = 2500;
// Opacity the button fades to while idle (peek / fade behaviors).
const IDLE_OPACITY = 0.55;
// Fraction of the button hidden past the edge while idle (rest peeks out).
const PEEK_HIDDEN_FRACTION = 0.35;

/** Which half the button sits in (drives hint alignment). */
interface Corner {
  isLeft: boolean;
  isTop: boolean;
}

/** The screen edge the button sticks to. Only left/right are supported. */
type Side = 'left' | 'right';

/** Screen-space bounds for the button's top-left coordinate. */
interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Best-effort safe-area insets without a `react-native-safe-area-context`
 * dependency: real StatusBar height on Android, device-size heuristics for iOS
 * notch / Dynamic Island / home-indicator devices.
 */
const getSafeInsets = (
  width: number,
  height: number
): { top: number; bottom: number } => {
  if (Platform.OS === 'android') {
    return { top: StatusBar.currentHeight ?? 0, bottom: 0 };
  }
  // iOS: notched / Dynamic Island devices are >= 812pt on their long edge.
  const hasNotch = Math.max(width, height) >= 812;
  return { top: hasNotch ? 47 : 20, bottom: hasNotch ? 34 : 0 };
};

const centerXY = (bounds: Bounds): { x: number; y: number } => ({
  x: (bounds.minX + bounds.maxX) / 2,
  y: (bounds.minY + bounds.maxY) / 2,
});

// Middle of the given side edge — where the button starts, flush and centered.
const edgeMidXY = (bounds: Bounds, side: Side): { x: number; y: number } => ({
  x: side === 'left' ? bounds.minX : bounds.maxX,
  y: (bounds.minY + bounds.maxY) / 2,
});

const sideToCorner = (side: Side): Corner => ({
  isLeft: side === 'left',
  isTop: false,
});

// Which edge the button rests against on first render.
const INITIAL_SIDE: Side = 'right';

/**
 * Border radii that turn the circle into a "tab": flat against the resting
 * edge, rounded on the inner side. Returns a full circle when not resting.
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
      return { borderRadius: radius };
  }
};

export interface SignLanguageFloatingButtonProps {
  /**
   * Whether tap-to-translate mode is currently active (affects styling and hint).
   */
  active: boolean;

  /**
   * Called when the button is tapped (not dragged).
   */
  onPress: () => void;

  /**
   * Primary brand color used as the default for the active fill / icon tint / border.
   * @default '#6750A4'
   */
  primaryColor?: string;

  /**
   * @deprecated The button now starts on the middle of a side edge and only
   * sticks to the left/right edges, so this no longer affects the start.
   */
  position?: FloatingButtonPosition;

  /**
   * What the button does after `idleDelay` ms of inactivity.
   * @default 'peek'
   */
  idleBehavior?: FloatingButtonIdleBehavior;

  /**
   * Milliseconds of inactivity before the idle behavior kicks in.
   * @default 2500
   */
  idleDelay?: number;

  /**
   * Diameter of the button in points.
   * @default 44
   */
  size?: number;

  /**
   * Fill color while the mode is OFF.
   * @default '#FFFFFF'
   */
  backgroundColor?: string;

  /**
   * Fill color while the mode is ON.
   * @default primaryColor
   */
  activeBackgroundColor?: string;

  /**
   * Logo tint while the mode is OFF.
   * @default primaryColor
   */
  iconColor?: string;

  /**
   * Logo tint while the mode is ON.
   * @default '#FFFFFF'
   */
  activeIconColor?: string;

  /**
   * Border color (drawn only while the mode is OFF).
   * @default primaryColor
   */
  borderColor?: string;

  /**
   * Hint text shown while the mode is active.
   * @default 'Çevirmek için bir yazıya dokunun'
   */
  hintText?: string;

  /**
   * Whether the active-mode hint bubble should be shown. Lets the provider hide
   * it after it has been seen enough times.
   * @default true
   */
  showHint?: boolean;
}

/**
 * Draggable, edge-sticky floating logo that toggles "tap-to-translate" mode.
 *
 * Starts resting on the middle of a side edge as a flush "tab". The user can
 * drag it anywhere; on release it springs to the nearest LEFT or RIGHT edge.
 * After a period of inactivity it tucks partly off that edge ("peek") so it
 * stops covering content — touching it wakes it back up.
 *
 * Rendered automatically by {@link SignLanguageProvider} while the SDK is enabled.
 */
export const SignLanguageFloatingButton: React.FC<
  SignLanguageFloatingButtonProps
> = ({
  active,
  onPress,
  primaryColor = DEFAULT_PRIMARY,
  idleBehavior = 'peek',
  idleDelay = DEFAULT_IDLE_DELAY,
  size = DEFAULT_BUTTON_SIZE,
  backgroundColor = '#FFFFFF',
  activeBackgroundColor,
  iconColor,
  activeIconColor = '#FFFFFF',
  borderColor,
  hintText = 'Çevirmek için bir yazıya dokunun',
  showHint = true,
}) => {
  const { width, height } = useWindowDimensions();

  // Resolve colors, falling back to the brand primary color.
  const resolvedActiveBg = activeBackgroundColor ?? primaryColor;
  const resolvedIconColor = iconColor ?? primaryColor;
  const resolvedBorderColor = borderColor ?? primaryColor;

  // Screen-space bounds for the button's top-left coordinate. Side edges stay
  // flush so the tab hugs the screen edge; the top/bottom respect the device
  // safe area (status bar, notch, home indicator).
  const bounds = useMemo<Bounds>(() => {
    const insets = getSafeInsets(width, height);
    return {
      minX: 0,
      maxX: Math.max(0, width - size),
      minY: insets.top,
      maxY: Math.max(insets.top, height - size - insets.bottom),
    };
  }, [width, height, size]);

  // pan holds the ABSOLUTE top-left position of the button (not a delta).
  // The button starts resting on the middle of a side edge (flush "tab").
  const pan = useRef<Animated.ValueXY>(
    new Animated.ValueXY(edgeMidXY(bounds, INITIAL_SIDE))
  ).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Which half the button sits in (drives hint alignment).
  const [corner, setCorner] = useState<Corner>(() =>
    sideToCorner(INITIAL_SIDE)
  );
  // The edge the button rests against. `null` while dragging (rendered as a
  // full circle); otherwise it renders as a flush "tab".
  const [restingSide, setRestingSide] = useState<Side | null>(INITIAL_SIDE);

  // Mutable refs shared between the PanResponder closure and effects.
  const currentXY = useRef(edgeMidXY(bounds, INITIAL_SIDE));
  const snappedXY = useRef(currentXY.current);
  const cornerRef = useRef(corner);
  const sideRef = useRef<Side>(INITIAL_SIDE);
  const isResting = useRef(true);
  const isPeeked = useRef(false);
  const wasPeekedOnGrant = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep config-driven values in refs so the PanResponder (created once) sees
  // the latest without being recreated mid-gesture.
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const idleBehaviorRef = useRef(idleBehavior);
  idleBehaviorRef.current = idleBehavior;
  const idleDelayRef = useRef(idleDelay);
  idleDelayRef.current = idleDelay;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  // Track the live position so we can read it on gesture end.
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

  // Snap horizontally to the nearer of the left/right edges, keeping the
  // vertical position free (clamped into the safe area).
  const computeSnap = (
    from: { x: number; y: number },
    b: Bounds,
    btnSize: number
  ): { target: { x: number; y: number }; corner: Corner; side: Side } => {
    const x = clamp(from.x, b.minX, b.maxX);
    const y = clamp(from.y, b.minY, b.maxY);
    const isLeft = x + btnSize / 2 < (b.minX + b.maxX + btnSize) / 2;
    const isTop = y + btnSize / 2 < (b.minY + b.maxY + btnSize) / 2;
    return {
      target: { x: isLeft ? b.minX : b.maxX, y },
      corner: { isLeft, isTop },
      side: isLeft ? 'left' : 'right',
    };
  };

  // Spring the button to a resolved target and (re)arm the idle timer.
  const settleAt = (
    target: { x: number; y: number },
    nextCorner: Corner,
    side: Side
  ) => {
    snappedXY.current = target;
    cornerRef.current = nextCorner;
    sideRef.current = side;
    isResting.current = true;
    setCorner(nextCorner);
    setRestingSide(side);
    isPeeked.current = false;
    Animated.parallel([
      Animated.spring(pan, {
        toValue: target,
        useNativeDriver: false,
        friction: 7,
        tension: 60,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(scheduleIdle);
  };

  const scheduleIdle = () => {
    clearIdleTimer();
    if (idleBehaviorRef.current === 'none') return;
    idleTimer.current = setTimeout(runIdle, idleDelayRef.current);
  };

  const runIdle = () => {
    // Only peek once the button is resting on an edge (not while floating).
    if (!isResting.current) return;
    isPeeked.current = true;
    const b = boundsRef.current;
    const btnSize = sizeRef.current;
    const anims: Animated.CompositeAnimation[] = [
      Animated.timing(opacity, {
        toValue: IDLE_OPACITY,
        duration: 220,
        useNativeDriver: false,
      }),
    ];
    if (idleBehaviorRef.current === 'peek') {
      // Slide partly off whichever edge it rests against, leaving most of the
      // button peeking out so it stays easy to grab.
      const hidden = btnSize * PEEK_HIDDEN_FRACTION;
      const { y } = snappedXY.current;
      const peek =
        sideRef.current === 'left'
          ? { x: b.minX - hidden, y }
          : { x: b.maxX + hidden, y };
      anims.push(
        Animated.spring(pan, {
          toValue: peek,
          useNativeDriver: false,
          friction: 8,
          tension: 50,
        })
      );
    }
    Animated.parallel(anims).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState
        ) =>
          Math.abs(g.dx) > TAP_MOVEMENT_THRESHOLD ||
          Math.abs(g.dy) > TAP_MOVEMENT_THRESHOLD,
        onPanResponderGrant: () => {
          // Wake the button: cancel idle, restore opacity, allow dragging from
          // wherever it currently sits (even half-peeked).
          clearIdleTimer();
          wasPeekedOnGrant.current = isPeeked.current;
          isPeeked.current = false;
          pan.stopAnimation();
          opacity.stopAnimation();
          opacity.setValue(1);
          pan.extractOffset();
          // Lift off the edge: while dragging it's a full circle again.
          isResting.current = false;
          setRestingSide(null);
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState
        ) => {
          pan.flattenOffset();
          const isTap =
            Math.abs(g.dx) <= TAP_MOVEMENT_THRESHOLD &&
            Math.abs(g.dy) <= TAP_MOVEMENT_THRESHOLD;

          if (isTap) {
            if (wasPeekedOnGrant.current) {
              // First touch on a peeked button just wakes it — no toggle.
              settleAt(snappedXY.current, cornerRef.current, sideRef.current);
            } else {
              // A tap in place: keep it flush against its edge.
              setRestingSide(sideRef.current);
              onPressRef.current();
              scheduleIdle();
            }
            return;
          }

          const {
            target,
            corner: nextCorner,
            side,
          } = computeSnap(currentXY.current, boundsRef.current, sizeRef.current);
          settleAt(target, nextCorner, side);
        },
      }),
    [pan, opacity]
  );

  // Keep the button on-screen when the size (rotation) or button size changes.
  useEffect(() => {
    clearIdleTimer();
    if (isResting.current) {
      // Re-snap to the same side, clamping the vertical position into bounds.
      const { target, corner: nextCorner, side } = computeSnap(
        currentXY.current,
        bounds,
        size
      );
      settleAt(target, nextCorner, side);
    } else {
      // Still floating: recenter.
      const c = centerXY(bounds);
      currentXY.current = c;
      pan.setValue(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, size]);

  // Arm the initial idle timer and clean everything up on unmount.
  useEffect(() => {
    scheduleIdle();
    return () => {
      clearIdleTimer();
      pan.stopAnimation();
      opacity.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hint sits below the button on top corners, above it on bottom corners.
  const hintVerticalStyle = corner.isTop
    ? { top: size + 8 }
    : { bottom: size + 8 };

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
        {active && showHint && !isPeeked.current ? (
          <View
            style={[
              styles.hint,
              hintVerticalStyle,
              corner.isLeft ? styles.hintLeft : styles.hintRight,
            ]}
            pointerEvents="none"
          >
            <Text style={styles.hintText} numberOfLines={2}>
              {hintText}
            </Text>
          </View>
        ) : null}

        <View
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel="İşaret dili çeviri modu"
          style={[
            styles.button,
            {
              width: size,
              height: size,
              backgroundColor: active ? resolvedActiveBg : backgroundColor,
              borderColor: resolvedBorderColor,
              borderWidth: active ? 0 : 2,
            },
            radiiForSide(restingSide, size / 2),
          ]}
        >
          <Image
            source={logoSource}
            resizeMode="contain"
            style={{
              width: size * 0.6,
              height: size * 0.6,
              tintColor: active ? activeIconColor : resolvedIconColor,
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  hint: {
    position: 'absolute',
    width: 180,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  hintLeft: {
    left: 0,
  },
  hintRight: {
    right: 0,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
});
