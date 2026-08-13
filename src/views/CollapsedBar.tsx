/**
 * The collapsed player: one 132x44 piece holding the mark, expand and close.
 *
 * No stage, no separate window pill — collapsed, the player is a single object.
 *
 * The mark takes the play button's place, so branding stays visible. Speed and
 * loop are **hidden, not disabled**: they belong to a video that is off screen,
 * and the user's choices are preserved for when it comes back.
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { resolveForeground } from '../core/contrast';
import { COLLAPSED_BAR_WIDTH, SHADOW, SIZE } from '../core/tokens';
import type { SignLanguageStrings } from '../core/strings';
import { ChevronGlyph, CloseGlyph } from './Glyph';
import { Control } from './SignControlBar';

const logoSource = require('../assets/logoHead.png');

export interface CollapsedBarProps {
  primaryColor: string;
  onPrimaryColor: string;
  radius: number;
  strings: SignLanguageStrings;
  closeLabel?: string;
  onExpand: () => void;
  onClose: () => void;
}

export const CollapsedBar: React.FC<CollapsedBarProps> = ({
  primaryColor,
  onPrimaryColor,
  radius,
  strings,
  closeLabel,
  onExpand,
  onClose,
}) => {
  const tint = resolveForeground(onPrimaryColor, primaryColor);

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: primaryColor, borderRadius: radius },
      ]}
    >
      {/* All three are drawn at one size. Every glyph fills its box optically
          (see Glyph.tsx), so equal sizes really do read as equal weights —
          which they did not when the mark, the chevron and the cross each had
          their own number. */}
      <View style={styles.markSlot}>
        <Image
          source={logoSource}
          resizeMode="contain"
          style={{
            width: SIZE.primaryIcon,
            height: SIZE.primaryIcon,
            tintColor: tint,
          }}
          accessible={false}
          importantForAccessibility="no"
        />
      </View>

      <Control label={strings.expandLabel} onPress={onExpand}>
        <ChevronGlyph size={SIZE.primaryIcon} color={tint} direction="up" />
      </Control>

      <Control label={closeLabel ?? strings.close} onPress={onClose}>
        <CloseGlyph size={SIZE.primaryIcon} color={tint} />
      </Control>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: COLLAPSED_BAR_WIDTH,
    height: SIZE.control,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW.floating,
  },
  markSlot: {
    width: SIZE.control,
    height: SIZE.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
