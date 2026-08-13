/**
 * The window pill: collapse and close, hanging above the stage's top-right
 * corner, outside its clip.
 *
 * `pillOverflowFraction` (0.8) of its 44 pt height sits above the stage's top
 * edge, so it costs the video only 20% of a control. That is the whole point:
 * anything that would occlude the signer is rejected, however convenient.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { resolveForeground } from '../core/contrast';
import { RADIUS, SHADOW, SIZE } from '../core/tokens';
import type { SignLanguageStrings } from '../core/strings';
import { ChevronGlyph, CloseGlyph } from './Glyph';
import { Control } from './SignControlBar';

export interface WindowPillProps {
  collapsed: boolean;
  primaryColor: string;
  onPrimaryColor: string;
  strings: SignLanguageStrings;
  closeLabel?: string;
  onToggleCollapsed: () => void;
  onClose: () => void;
}

export const WindowPill: React.FC<WindowPillProps> = ({
  collapsed,
  primaryColor,
  onPrimaryColor,
  strings,
  closeLabel,
  onToggleCollapsed,
  onClose,
}) => {
  const tint = resolveForeground(onPrimaryColor, primaryColor);

  return (
    <View style={[styles.pill, { backgroundColor: primaryColor }]}>
      <Control
        label={collapsed ? strings.expandLabel : strings.collapseLabel}
        onPress={onToggleCollapsed}
      >
        <ChevronGlyph
          size={SIZE.icon}
          color={tint}
          direction={collapsed ? 'up' : 'down'}
        />
      </Control>

      <View style={[styles.divider, { backgroundColor: tint }]} />

      <Control label={closeLabel ?? strings.close} onPress={onClose}>
        {/* Same size as the chevron beside it — both glyphs fill their box. */}
        <CloseGlyph size={SIZE.icon} color={tint} />
      </Control>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    height: SIZE.control,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.medium,
    ...SHADOW.pill,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: SIZE.icon,
    opacity: 0.4,
  },
});
