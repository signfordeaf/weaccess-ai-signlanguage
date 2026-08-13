/**
 * The veil laid over the idle avatar while a translation is in flight.
 *
 * Its job is to read as "not the final video". An unblurred loop is
 * indistinguishable from a finished translation, and showing something the user
 * can mistake for the answer is the failure mode this exists to prevent.
 *
 * React Native has no built-in blur. Rather than reach for an optional peer
 * dependency — an unresolvable `require` corrupts the dependency map of the
 * module it sits in, and Metro surfaces the throw even from inside a `catch` —
 * the integration *injects* a blur component if it wants one:
 *
 * ```tsx
 * import { BlurView } from '@react-native-community/blur';
 * <SignLanguageProvider config={{ ..., card: { blurComponent: BlurView } }}>
 * ```
 *
 * Without one the veil falls back to a translucent scrim of the surface color
 * under the same spinner. It still reads as "not the answer" either way, which
 * is the behavior that actually matters.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LOADING } from '../core/tokens';
import { SpinnerRing } from './Glyph';
import { getConfig } from '../core/config';

export interface SpinnerProps {
  size?: number;
  color: string;
}

/** A continuously rotating ring. */
export const Spinner: React.FC<SpinnerProps> = ({
  size = LOADING.indicatorSize,
  color,
}) => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <SpinnerRing size={size} color={color} stroke={LOADING.indicatorStroke} />
    </Animated.View>
  );
};

export interface LoadingVeilProps {
  /** The theme's primary color — the spinner is drawn in it. */
  color: string;
  /** Stood in for the blur when the optional library is absent. */
  surfaceColor: string;
  /**
   * Whether to draw the blur at all. The veil is applied *only* while loading:
   * blurring an idle player would promise a video that is not coming.
   */
  blur?: boolean;
}

export const LoadingVeil: React.FC<LoadingVeilProps> = ({
  color,
  surfaceColor,
  blur = true,
}) => {
  // Supplied by the integration, never required from here: an unresolvable
  // `require` of an uninstalled package breaks the bundle it sits in.
  const BlurView = getConfig().card.blurComponent ?? null;

  return (
    <View style={styles.veil} pointerEvents="none">
      {blur ? (
        BlurView ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            blurAmount={LOADING.blurSigma}
            blurType="light"
            reducedTransparencyFallbackColor={surfaceColor}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: surfaceColor, opacity: 0.55 },
            ]}
          />
        )
      ) : null}

      <Spinner color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  veil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
