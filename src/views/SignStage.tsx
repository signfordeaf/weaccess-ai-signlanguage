/**
 * The stage: the avatar area, where the video and the idle loop are drawn.
 *
 * | State     | Shows                                                    |
 * | --------- | -------------------------------------------------------- |
 * | `ready`   | The translation video, centred, at its own aspect ratio   |
 * | `loading` | Idle signer loop, blurred, spinner over it                |
 * | `idle`    | Idle signer loop, clean — no blur, no spinner, no label   |
 * | `error`   | Localized failure message, centred in the stage           |
 * | `blocked` | Localized sensitive-data message, centred in the stage    |
 *
 * Failure states render *inside* the stage, so the layout never jumps and the
 * app stays usable. No logo is drawn in those states — the corner badge already
 * carries the mark, and a second copy competes with it on a stage this small.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TranslationState } from '../types';
import type { Signer } from '../core/signers';
import type { SignLanguageStrings } from '../core/strings';
import { resolveForeground } from '../core/contrast';
import { SPACE } from '../core/tokens';
import { IdleAvatar } from './IdleAvatar';
import { LoadingVeil } from './LoadingVeil';
import { VideoSurface } from './VideoSurface';
import { ActionPills } from './ActionPills';

export interface SignStageProps {
  state: TranslationState;
  width: number;
  height: number;
  radius: number;

  videoUrl?: string;
  isPlaying: boolean;
  speed: number;
  looping: boolean;

  signer: Signer;
  placeholderAsset?: string | null;

  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  strings: SignLanguageStrings;

  /** Feedback pill, off by default. */
  showFeedback: boolean;
  feedbackVote?: boolean;
  feedbackAcknowledged: boolean;
  onVote?: (positive: boolean) => void;

  videoPlayerLabel?: string;
  onVideoEnd?: () => void;
  onVideoError?: () => void;
  onAspectRatio?: (aspect: number) => void;
}

export const SignStage: React.FC<SignStageProps> = ({
  state,
  width,
  height,
  radius,
  videoUrl,
  isPlaying,
  speed,
  looping,
  signer,
  placeholderAsset,
  primaryColor,
  surfaceColor,
  textColor,
  strings,
  showFeedback,
  feedbackVote,
  feedbackAcknowledged,
  onVote,
  videoPlayerLabel,
  onVideoEnd,
  onVideoError,
  onAspectRatio,
}) => {
  const message =
    state === 'error'
      ? strings.error
      : state === 'blocked'
      ? strings.sensitiveBlocked
      : null;

  // Never painted directly: a configured text color that fails 4.5:1 against
  // the surface is a defect, not a styling opinion.
  const readableText = resolveForeground(textColor, surfaceColor);

  return (
    <View
      style={[
        styles.stage,
        { width, height, borderRadius: radius, backgroundColor: surfaceColor },
      ]}
    >
      {message ? (
        // Vertically centred, and scrolling if it outgrows the stage.
        <ScrollView
          style={StyleSheet.absoluteFill}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.message, { color: readableText }]}>
            {message}
          </Text>
        </ScrollView>
      ) : state === 'ready' && videoUrl ? (
        <VideoSurface
          source={videoUrl}
          paused={!isPlaying}
          repeat={looping}
          rate={speed}
          resizeMode="contain"
          onEnd={onVideoEnd}
          onError={onVideoError}
          onAspectRatio={onAspectRatio}
          accessibilityLabel={videoPlayerLabel ?? strings.videoPlayerLabel}
        />
      ) : (
        <>
          <IdleAvatar
            signer={signer}
            placeholderAsset={placeholderAsset}
            color={primaryColor}
          />
          {/* The veil is applied only while loading. An idle player plays the
              loop clean, so it never promises a video that is not coming. */}
          {state === 'loading' ? (
            <LoadingVeil color={primaryColor} surfaceColor={surfaceColor} />
          ) : null}
        </>
      )}

      {/* Top-left, spaceXs from each edge — well clear of the signing space. */}
      <ActionPills
        primaryColor={primaryColor}
        surfaceColor={surfaceColor}
        strings={strings}
        showFeedback={showFeedback && state === 'ready'}
        vote={feedbackVote}
        acknowledged={feedbackAcknowledged}
        onVote={onVote}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
