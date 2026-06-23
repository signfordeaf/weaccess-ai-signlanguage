import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import type { FloatingButtonPosition } from '../types';

const logoSource = require('../assets/logoHead.png');

// Movement (in points) below which a gesture is treated as a tap rather than a drag.
const TAP_MOVEMENT_THRESHOLD = 6;
const DEFAULT_BUTTON_SIZE = 44;
const EDGE_MARGIN = 24;
const DEFAULT_PRIMARY = '#6750A4';

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
   * Corner the button starts in. It can be dragged anywhere afterwards.
   * @default 'bottom-right'
   */
  position?: FloatingButtonPosition;

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
}

/**
 * Draggable floating logo that toggles "tap-to-translate" mode.
 *
 * Rendered automatically by {@link SignLanguageProvider} while the SDK is enabled.
 * The user taps it to enter a mode where tapping any on-screen text translates it.
 */
export const SignLanguageFloatingButton: React.FC<
  SignLanguageFloatingButtonProps
> = ({
  active,
  onPress,
  primaryColor = DEFAULT_PRIMARY,
  position = 'bottom-right',
  size = DEFAULT_BUTTON_SIZE,
  backgroundColor = '#FFFFFF',
  activeBackgroundColor,
  iconColor,
  activeIconColor = '#FFFFFF',
  borderColor,
  hintText = 'Çevirmek için bir yazıya dokunun',
}) => {
  const { width, height } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;

  // Resolve colors, falling back to the brand primary color.
  const resolvedActiveBg = activeBackgroundColor ?? primaryColor;
  const resolvedIconColor = iconColor ?? primaryColor;
  const resolvedBorderColor = borderColor ?? primaryColor;

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
          pan.extractOffset();
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
            onPress();
          }
        },
      }),
    [pan, onPress]
  );

  // Anchor the button to the requested corner; dragging translates from here.
  const cornerStyle = useMemo(() => {
    const vertical = position.startsWith('top')
      ? { top: EDGE_MARGIN }
      : { bottom: EDGE_MARGIN };
    const horizontal = position.endsWith('left')
      ? { left: EDGE_MARGIN }
      : { right: EDGE_MARGIN };
    return { ...vertical, ...horizontal };
  }, [position]);

  const hintOnLeft = position.endsWith('right');

  return (
    // Full-screen, non-blocking overlay; only the button captures touches.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.container,
          cornerStyle,
          {
            transform: [
              {
                translateX: pan.x.interpolate({
                  inputRange: [-width, width],
                  outputRange: [-width, width],
                }),
              },
              {
                translateY: pan.y.interpolate({
                  inputRange: [-height, height],
                  outputRange: [-height, height],
                }),
              },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {active ? (
          <View
            style={[
              styles.hint,
              { bottom: size + 8 },
              hintOnLeft ? styles.hintLeft : styles.hintRight,
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
              borderRadius: size / 2,
              backgroundColor: active ? resolvedActiveBg : backgroundColor,
              borderColor: resolvedBorderColor,
              borderWidth: active ? 0 : 2,
            },
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
    right: 0,
  },
  hintRight: {
    left: 0,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
});
