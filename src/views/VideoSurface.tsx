/**
 * The one place the SDK touches a video decoder.
 *
 * React Native has no built-in video, so the SDK ships its own native view
 * rather than requiring `react-native-video`. That is not a preference: React
 * Native's autolinking reads only the *host app's* `package.json` and never
 * walks the dependency tree, so a library cannot bring a native module along
 * with it — the integrator would have to install it themselves either way.
 * Owning the view is what makes `npm install weaccess-ai-signlanguage` the whole
 * setup.
 *
 * The surface below is everything the SDK needs from a player. There is no
 * seeking, no DRM, no streaming, no subtitles, and no audio session handling —
 * the SDK deliberately never touches the host app's audio session for a clip
 * that is usually silent.
 */

import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  requireNativeComponent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { AssetSource } from './placeholderAssets';

interface NativeLoadEvent {
  width: number;
  height: number;
}

interface NativeErrorEvent {
  code?: string;
  message?: string;
}

interface SignVideoNativeProps {
  uri: string;
  paused: boolean;
  repeats: boolean;
  muted: boolean;
  rate: number;
  resizeMode: string;
  style?: StyleProp<ViewStyle>;
  onSignVideoLoad?: (event: NativeSyntheticEvent<NativeLoadEvent>) => void;
  onSignVideoEnd?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
  onSignVideoError?: (event: NativeSyntheticEvent<NativeErrorEvent>) => void;
  accessible?: boolean;
  accessibilityLabel?: string;
}

const SignVideoNative =
  requireNativeComponent<SignVideoNativeProps>('SignVideoView');

export interface VideoSurfaceProps {
  /** A remote URL, or a bundled asset from `require()`. */
  source: string | AssetSource;
  style?: StyleProp<ViewStyle>;
  paused?: boolean;
  repeat?: boolean;
  muted?: boolean;
  rate?: number;
  /** `contain` letterboxes; the stage is sized to the ratio so it rarely shows. */
  resizeMode?: 'contain' | 'cover' | 'stretch';
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  /** Reports the natural aspect ratio once the decoder knows it. */
  onAspectRatio?: (aspect: number) => void;
  accessibilityLabel?: string;
}

/**
 * Turn a source into a plain URI string.
 *
 * `require('…mp4')` evaluates to an opaque number, so it is resolved here rather
 * than natively: the asset registry knows whether to hand back a dev-server URL
 * or a bundled path, and resolving in JavaScript means native has one input type
 * instead of two.
 */
export const resolveVideoUri = (source: string | AssetSource): string => {
  if (typeof source === 'string') return source;
  return Image.resolveAssetSource(source)?.uri ?? '';
};

export const VideoSurface: React.FC<VideoSurfaceProps> = ({
  source,
  style,
  paused = false,
  repeat = false,
  muted = false,
  rate = 1,
  resizeMode = 'contain',
  onEnd,
  onError,
  onAspectRatio,
  accessibilityLabel,
}) => {
  const uri = useMemo(() => resolveVideoUri(source), [source]);

  return (
    <SignVideoNative
      uri={uri}
      style={[StyleSheet.absoluteFill, style]}
      paused={paused}
      repeats={repeat}
      muted={muted}
      rate={rate}
      resizeMode={resizeMode}
      onSignVideoLoad={(event) => {
        const { width, height } = event.nativeEvent;
        if (onAspectRatio && width > 0 && height > 0) {
          onAspectRatio(width / height);
        }
      }}
      onSignVideoEnd={() => onEnd?.()}
      onSignVideoError={(event) => onError?.(event.nativeEvent)}
      // The mark in the corner carries the branding; the stage labels the video
      // itself for screen readers.
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    />
  );
};
