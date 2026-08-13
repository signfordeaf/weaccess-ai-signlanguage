/**
 * The caption: the sentence being translated.
 *
 * It appears from the moment a translation starts — before the video arrives —
 * so the user can confirm what they tapped.
 *
 * The hold at the top is what makes the first words readable at all: without it
 * the sentence starts sliding before the eye has landed on it. And a caption
 * the reader has to drag is a caption most readers never finish, which is why
 * this scrolls itself rather than waiting to be dragged.
 *
 * It draws **no background of its own** and no divider separates it from the
 * controls: they share one surface, so the block reads as a single object
 * rather than two stacked cards.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { resolveForeground } from '../core/contrast';
import { CAPTION, SPACE } from '../core/tokens';

export interface SignCaptionProps {
  text?: string;
  width: number;
  /** Reserved height, from the sizing algorithm. Includes the padding. */
  height: number;
  primaryColor: string;
  onPrimaryColor: string;
  /** System font scale, so the caption grows instead of clipping. */
  fontScale?: number;
  radius: number;
}

export const SignCaption: React.FC<SignCaptionProps> = ({
  text,
  width,
  height,
  primaryColor,
  onPrimaryColor,
  fontScale = 1,
  radius,
}) => {
  const offset = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  const fontSize = CAPTION.fontSize * fontScale;
  const lineHeight = fontSize * CAPTION.lineHeight;
  const visibleHeight = height - SPACE.sm * 2;
  const overflow = Math.max(0, contentHeight - visibleHeight);

  const tint = resolveForeground(onPrimaryColor, primaryColor);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  }, []);

  // A new sentence jumps back to the top and restarts the cycle.
  useEffect(() => {
    offset.setValue(0);
  }, [text, offset]);

  useEffect(() => {
    // A caption that fits is centred and still.
    if (overflow <= 0 || !text) {
      offset.setValue(0);
      return;
    }

    const travelMs = Math.min(
      CAPTION.maxTravelMs,
      Math.max(CAPTION.minTravelMs, (overflow / CAPTION.scrollSpeed) * 1000)
    );

    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(CAPTION.holdMs),
        Animated.timing(offset, {
          toValue: -overflow,
          duration: travelMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(CAPTION.holdMs),
        Animated.timing(offset, {
          toValue: 0,
          duration: CAPTION.rewindMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [overflow, text, offset]);

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor: primaryColor,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
        },
      ]}
      // One block, one announcement.
      accessible
      accessibilityLabel={text}
    >
      <View style={styles.viewport}>
        {/* Absolutely positioned on purpose. A flow child of a fixed-height
            parent is *height-constrained* by it, so the sentence would lay out
            to two lines and truncate mid-word — there would be nothing left to
            scroll. Taken out of flow it lays out at its full height, and the
            viewport clips what the translation has not brought into view. */}
        <Animated.View
          style={[
            styles.scroller,
            {
              // A caption that fits is centred; one that scrolls starts at the
              // top, because that is where reading starts.
              top:
                overflow > 0
                  ? 0
                  : Math.max(0, (visibleHeight - contentHeight) / 2),
              transform: [{ translateY: offset }],
            },
          ]}
        >
          <Text
            onLayout={onContentLayout}
            style={[styles.text, { color: tint, fontSize, lineHeight }]}
          >
            {text ?? ''}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    justifyContent: 'center',
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  scroller: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  text: {
    textAlign: 'center',
  },
});
