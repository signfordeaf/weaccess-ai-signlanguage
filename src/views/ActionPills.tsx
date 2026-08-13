/**
 * The mark badge, and the optional feedback pill beside it.
 *
 * Both sit in the **top-left** of the stage, `spaceXs` from each edge — well
 * clear of the signing space. Never take the lower third of the stage: in sign
 * language the hands carry the meaning.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveForeground } from '../core/contrast';
import { OVERLAY, RADIUS, SIZE, SPACE } from '../core/tokens';
import type { SignLanguageStrings } from '../core/strings';

const logoSource = require('../assets/logoHead.png');

const BADGE_SIZE = 28;

export interface ActionPillsProps {
  primaryColor: string;
  surfaceColor: string;
  strings: SignLanguageStrings;
  showFeedback: boolean;
  vote?: boolean;
  acknowledged: boolean;
  onVote?: (positive: boolean) => void;
}

/**
 * A thumb, drawn from a rounded stem and a paddle. Like the control glyphs,
 * this avoids an icon dependency for a shape this simple.
 */
const ThumbGlyph: React.FC<{ size: number; color: string; up: boolean }> = ({
  size,
  color,
  up,
}) => (
  <View
    style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: up ? '0deg' : '180deg' }],
    }}
  >
    <View
      style={{
        width: size * 0.24,
        height: size * 0.34,
        borderRadius: size * 0.06,
        backgroundColor: color,
        marginLeft: -size * 0.3,
        marginBottom: -size * 0.06,
      }}
    />
    <View
      style={{
        width: size * 0.78,
        height: size * 0.42,
        borderTopLeftRadius: size * 0.2,
        borderTopRightRadius: size * 0.06,
        borderBottomRightRadius: size * 0.1,
        backgroundColor: color,
      }}
    />
  </View>
);

export const ActionPills: React.FC<ActionPillsProps> = ({
  primaryColor,
  surfaceColor,
  strings,
  showFeedback,
  vote,
  acknowledged,
  onVote,
}) => {
  const markTint = resolveForeground(primaryColor, surfaceColor);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* The mark is always visible over the avatar. */}
      <View style={[styles.badge, { backgroundColor: surfaceColor }]}>
        <Image
          source={logoSource}
          resizeMode="contain"
          style={{
            width: BADGE_SIZE * 0.7,
            height: BADGE_SIZE * 0.7,
            tintColor: markTint,
          }}
          // Decoration — announcing it on every focus traversal is noise.
          accessible={false}
          importantForAccessibility="no"
        />
      </View>

      {showFeedback ? (
        <View style={[styles.pill, { backgroundColor: surfaceColor }]}>
          {acknowledged ? (
            <Text
              style={[styles.thanks, { color: markTint }]}
              numberOfLines={1}
              accessibilityLiveRegion="polite"
            >
              {strings.feedbackThanks}
            </Text>
          ) : (
            <>
              {[true, false].map((positive) => (
                <Pressable
                  key={String(positive)}
                  onPress={() => onVote?.(positive)}
                  style={styles.voteTarget}
                  accessibilityRole="button"
                  accessibilityState={{ selected: vote === positive }}
                  accessibilityLabel={
                    positive
                      ? strings.feedbackPositiveLabel
                      : strings.feedbackNegativeLabel
                  }
                >
                  <View
                    style={{
                      opacity:
                        vote === undefined || vote === positive
                          ? 1
                          : OVERLAY.disabledOpacity,
                    }}
                  >
                    <ThumbGlyph size={16} color={markTint} up={positive} />
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: SPACE.xs,
    left: SPACE.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    marginLeft: SPACE.xs,
    borderRadius: RADIUS.medium,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.xs,
    maxWidth: 120,
  },
  voteTarget: {
    // A pill button is a full control target like any other.
    minWidth: SIZE.control / 2,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thanks: {
    fontSize: 10,
    paddingHorizontal: SPACE.xs,
  },
});
