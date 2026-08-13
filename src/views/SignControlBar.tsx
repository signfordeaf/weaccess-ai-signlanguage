/**
 * The control bar.
 *
 * It sits **below** the stage, never over it. The web SDK overlays it; the
 * mobile SDK deliberately does not, because in sign language the hands carry
 * the meaning.
 *
 * Every control keeps its full 44x44 hit area regardless of the bar's width.
 * Shrinking the bar never comes out of the controls' tap targets — hierarchy
 * comes from the icon inside, not from differently sized boxes.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveForeground } from '../core/contrast';
import { OVERLAY, RADIUS, SIZE, SPACE } from '../core/tokens';
import type { SignLanguageStrings } from '../core/strings';
import { LoopGlyph, PauseGlyph, PlayGlyph } from './Glyph';

export interface ControlProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  children: React.ReactNode;
}

/** One 44x44 target. The only control size there is. */
export const Control: React.FC<ControlProps> = ({
  label,
  onPress,
  disabled,
  selected,
  children,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled, selected: !!selected }}
    style={styles.control}
  >
    <View style={{ opacity: disabled ? OVERLAY.disabledOpacity : 1 }}>
      {children}
    </View>
  </Pressable>
);

export interface SignControlBarProps {
  width: number;
  radius: number;

  primaryColor: string;
  onPrimaryColor: string;
  strings: SignLanguageStrings;

  isPlaying: boolean;
  /** Play is disabled until the video is ready; speed and loop are not. */
  playbackAvailable: boolean;
  speed: number;
  looping: boolean;

  showSpeed: boolean;
  showLoop: boolean;
  showContact: boolean;

  /**
   * Whether the bar is the bottom of the control block.
   *
   * The caption normally carries the block's bottom corners; with no sentence
   * to show it is not drawn at all, and the bar has to round its own.
   */
  isLastBlock?: boolean;

  onTogglePlayback: () => void;
  onCycleSpeed: () => void;
  onToggleLoop: () => void;
  onContact?: () => void;
}

/** How many controls the bar is currently showing. */
export const controlCountFor = (options: {
  showSpeed: boolean;
  showLoop: boolean;
  showContact: boolean;
}): number =>
  1 +
  (options.showSpeed ? 1 : 0) +
  (options.showLoop ? 1 : 0) +
  (options.showContact ? 1 : 0);

/** An envelope, for the contact control. */
const ContactGlyph: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <View
    style={{
      width: size,
      height: size * 0.74,
      borderWidth: Math.max(1.5, size * 0.09),
      borderColor: color,
      borderRadius: size * 0.1,
      overflow: 'hidden',
      alignItems: 'center',
    }}
  >
    <View
      style={{
        width: size * 0.62,
        height: size * 0.62,
        borderRightWidth: Math.max(1.5, size * 0.09),
        borderBottomWidth: Math.max(1.5, size * 0.09),
        borderRightColor: color,
        borderBottomColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -size * 0.34,
      }}
    />
  </View>
);

export const SignControlBar: React.FC<SignControlBarProps> = ({
  width,
  radius,
  primaryColor,
  onPrimaryColor,
  strings,
  isPlaying,
  playbackAvailable,
  speed,
  looping,
  showSpeed,
  showLoop,
  showContact,
  isLastBlock = false,
  onTogglePlayback,
  onCycleSpeed,
  onToggleLoop,
  onContact,
}) => {
  const tint = resolveForeground(onPrimaryColor, primaryColor);

  return (
    <View
      style={[
        styles.bar,
        {
          width,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          backgroundColor: primaryColor,
          ...(isLastBlock
            ? {
                borderBottomLeftRadius: radius,
                borderBottomRightRadius: radius,
              }
            : null),
        },
      ]}
    >
      <Control
        label={isPlaying ? strings.pauseLabel : strings.playLabel}
        onPress={onTogglePlayback}
        disabled={!playbackAvailable}
      >
        {isPlaying ? (
          <PauseGlyph size={SIZE.primaryIcon} color={tint} />
        ) : (
          <PlayGlyph size={SIZE.primaryIcon} color={tint} />
        )}
      </Control>

      {showSpeed ? (
        <Control label={strings.speedLabel} onPress={onCycleSpeed}>
          <View
            style={[
              styles.speedChip,
              {
                backgroundColor: OVERLAY.controlFill,
                borderColor: OVERLAY.controlBorder,
              },
            ]}
          >
            <Text style={[styles.speedText, { color: tint }]} numberOfLines={1}>
              {`${speed.toFixed(1)}x`}
            </Text>
          </View>
        </Control>
      ) : null}

      {showLoop ? (
        <Control
          label={strings.loopLabel}
          onPress={onToggleLoop}
          selected={looping}
        >
          <View style={{ opacity: looping ? 1 : OVERLAY.disabledOpacity }}>
            <LoopGlyph size={SIZE.icon} color={tint} />
          </View>
        </Control>
      ) : null}

      {showContact ? (
        <Control label={strings.contactLabel} onPress={() => onContact?.()}>
          <ContactGlyph size={SIZE.icon} color={tint} />
        </Control>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: SIZE.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  control: {
    width: SIZE.control,
    height: SIZE.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedChip: {
    borderRadius: RADIUS.small,
    borderWidth: 1,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    minWidth: 44,
    alignItems: 'center',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
