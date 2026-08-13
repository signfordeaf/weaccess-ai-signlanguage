/**
 * Control glyphs, drawn from plain views.
 *
 * The SDK needs six shapes — play, pause, close, two chevrons and loop. Every
 * one of them is geometric, so they are composed from bordered and rotated
 * `View`s rather than pulling in an icon font or an SVG renderer. That keeps
 * the SDK's dependency surface to the one thing it genuinely cannot do itself
 * (video), and it means every glyph tints from a single `color` prop with no
 * asset pipeline behind it.
 *
 * **Every glyph fills its `size` box optically.** That is the contract that lets
 * callers put two of them side by side and have them read as the same size —
 * without it each glyph needs its own fudge factor, which is how the collapsed
 * bar ended up with a mark, a chevron and a cross at three different weights.
 *
 * Each glyph is centred by its parent, and none sets its own hit area: every
 * control is a 44 pt target regardless of the glyph inside it.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

export interface GlyphProps {
  /** Edge length of the box the glyph draws inside. */
  size: number;
  color: string;
}

/** A right-pointing triangle, via the border trick. */
export const PlayGlyph: React.FC<GlyphProps> = ({ size, color }) => (
  <View
    style={{
      width: 0,
      height: 0,
      borderTopWidth: size * 0.5,
      borderBottomWidth: size * 0.5,
      borderLeftWidth: size * 0.85,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: color,
      // The triangle's visual centre sits left of its bounding box.
      marginLeft: size * 0.15,
    }}
  />
);

/**
 * Two rounded bars.
 *
 * The gap is a fifth of the box, not whatever is left over: spacing the bars to
 * the full width pushed them into the corners and read as two unrelated marks
 * rather than one pause symbol.
 */
export const PauseGlyph: React.FC<GlyphProps> = ({ size, color }) => {
  const bar = {
    width: size * 0.3,
    height: size,
    borderRadius: size * 0.1,
    backgroundColor: color,
  };
  return (
    <View style={[styles.row, { width: size, justifyContent: 'center' }]}>
      <View style={bar} />
      <View style={[bar, { marginLeft: size * 0.2 }]} />
    </View>
  );
};

/** Two bars crossed at right angles. */
export const CloseGlyph: React.FC<GlyphProps> = ({ size, color }) => {
  const bar = {
    position: 'absolute' as const,
    width: size,
    height: Math.max(1.5, size * 0.12),
    borderRadius: size * 0.06,
    backgroundColor: color,
  };
  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
};

export interface ChevronProps extends GlyphProps {
  direction: 'up' | 'down';
}

/**
 * A chevron, drawn as a square with two adjacent borders, rotated 45°.
 *
 * This reads more crisply at small sizes than two separate rotated bars, which
 * leave a notch where they meet.
 *
 * The edge is `size / √2` so the rotated square's diagonal spans the full box —
 * without that the chevron is only 88% of its nominal size, and sitting next to
 * a close glyph that does fill its box it reads as the smaller of the two.
 */
export const ChevronGlyph: React.FC<ChevronProps> = ({
  size,
  color,
  direction,
}) => {
  const stroke = Math.max(1.5, size * 0.14);
  const edge = size / Math.SQRT2;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: edge,
          height: edge,
          borderRightWidth: stroke,
          borderBottomWidth: stroke,
          borderRightColor: color,
          borderBottomColor: color,
          // Order matters: `translateY` must come *first* so it moves the
          // glyph down the screen. After a rotate it would move down the
          // *rotated* axis, i.e. diagonally — which is what made the chevron
          // sit askew of the mark and the cross beside it.
          //
          // Only two of the square's four edges are inked, so after rotating,
          // all the ink lies on one side of the centre: the V spans half the
          // box's height and starts at the middle. Shifting by a quarter of the
          // box centres it.
          transform: [
            { translateY: (direction === 'down' ? -0.25 : 0.25) * size },
            { rotate: direction === 'down' ? '45deg' : '-135deg' },
          ],
        }}
      />
    </View>
  );
};

/**
 * The repeat mark: a rounded rectangle broken on two sides, with an arrowhead
 * at each break.
 */
export const LoopGlyph: React.FC<GlyphProps> = ({ size, color }) => {
  const stroke = Math.max(1.5, size * 0.11);
  const head = size * 0.22;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      {/* Upper track, open on the right. */}
      <View
        style={{
          height: size * 0.34,
          marginHorizontal: size * 0.06,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderTopColor: color,
          borderLeftColor: color,
          borderTopLeftRadius: size * 0.16,
          marginBottom: stroke,
        }}
      />
      {/* Lower track, open on the left. */}
      <View
        style={{
          height: size * 0.34,
          marginHorizontal: size * 0.06,
          borderBottomWidth: stroke,
          borderRightWidth: stroke,
          borderBottomColor: color,
          borderRightColor: color,
          borderBottomRightRadius: size * 0.16,
        }}
      />
      {/* Arrowhead closing the upper track, pointing right. */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: size * 0.06,
          width: 0,
          height: 0,
          borderTopWidth: head * 0.6,
          borderBottomWidth: head * 0.6,
          borderLeftWidth: head,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
      {/* Arrowhead closing the lower track, pointing left. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: size * 0.06,
          width: 0,
          height: 0,
          borderTopWidth: head * 0.6,
          borderBottomWidth: head * 0.6,
          borderRightWidth: head,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
        }}
      />
    </View>
  );
};

/** A simple ring, used as the loading indicator's track. */
export const SpinnerRing: React.FC<GlyphProps & { stroke?: number }> = ({
  size,
  color,
  stroke = 2.5,
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: stroke,
      borderColor: color,
      // One transparent edge is what makes the rotation legible.
      borderTopColor: 'transparent',
    }}
  />
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
