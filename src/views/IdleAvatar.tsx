/**
 * The idle signer loop.
 *
 * While a translation is being fetched the player does not show a spinner on an
 * empty stage — it shows a signer, looping and muted. Which signer follows the
 * ids in use, because a fixed default once looped one person while the
 * translation came back in another's hands.
 *
 * If the clip cannot be played — missing asset, unsupported platform, decoder
 * failure — this falls back silently: the spinner alone while loading, the SDK
 * mark at 35% of the primary color while idle. A decorative loop is never worth
 * an error.
 */

import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { IDLE_FALLBACK_MARK } from '../core/tokens';
import type { Signer } from '../core/signers';
import { placeholderAssetFor, type AssetSource } from './placeholderAssets';
import { VideoSurface } from './VideoSurface';

const logoSource = require('../assets/logoHead.png');

export interface IdleAvatarProps {
  signer: Signer;
  /**
   * A host-supplied clip, overriding the bundled one entirely. An empty string
   * opts out of video altogether, leaving the fallback.
   */
  placeholderAsset?: string | null;
  /** Theme primary, used to tint the fallback mark. */
  color: string;
}

/** The mark, shown when there is no clip to play. */
const FallbackMark: React.FC<{ color: string }> = ({ color }) => (
  <Image
    source={logoSource}
    resizeMode="contain"
    style={{
      width: IDLE_FALLBACK_MARK.size,
      height: IDLE_FALLBACK_MARK.size,
      tintColor: color,
      opacity: IDLE_FALLBACK_MARK.opacity,
    }}
    // Decoration: announcing it on every focus traversal is noise.
    accessible={false}
    importantForAccessibility="no"
  />
);

export const IdleAvatar: React.FC<IdleAvatarProps> = ({
  signer,
  placeholderAsset,
  color,
}) => {
  const [failed, setFailed] = useState(false);

  // Recreate the decoder when the resolved signer or the host asset changes;
  // never keep one per signer.
  useEffect(() => {
    setFailed(false);
  }, [signer.id, placeholderAsset]);

  // An empty string is an explicit opt-out, distinct from "not configured".
  const optedOut = placeholderAsset === '';

  const source: string | AssetSource | null = optedOut
    ? null
    : placeholderAsset
    ? placeholderAsset
    : placeholderAssetFor(signer.id);

  if (failed || source == null) {
    return (
      <View style={styles.centre}>
        <FallbackMark color={color} />
      </View>
    );
  }

  return (
    <VideoSurface
      source={source}
      // Continuous and muted. The boomerang is baked into the asset, because
      // players cannot play in reverse and seeking backwards forces a keyframe
      // decode per frame.
      repeat
      muted
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

const styles = StyleSheet.create({
  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
