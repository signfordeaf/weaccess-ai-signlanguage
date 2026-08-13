import type React from 'react';

/**
 * Type definitions for weaccess-ai-signlanguage
 */

/**
 * Supported languages for sign language translation
 */
export type Language = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ar';

/**
 * Configuration options for the Sign Language SDK
 */
export interface SignLanguageConfig {
  /**
   * API key (rk parameter) provided by SignForDeaf
   */
  apiKey: string;

  /**
   * Base URL for the translation API
   * @example 'https://your-instance.signfordeaf.com'
   */
  apiUrl: string;

  /**
   * Identifies the calling app to the backend. Sent as both the `Origin`
   * header and the `url` query parameter, which must carry the same value.
   * @default apiUrl
   */
  originUrl?: string;

  /**
   * Source language of the text. Also picks the UI strings.
   *
   * Only `tr`, `en` and `ar` are supported by the backend; the others are
   * accepted for backward compatibility and fall back to English strings.
   * @default 'tr'
   */
  language?: Language;

  /**
   * The translator, by name. Fills in `tid`/`fdid` from the bundled table, so
   * an integration can pick a signer without carrying the ids around — and the
   * idle loop follows, because it reads the same pair.
   *
   * An explicit `tid`/`fdid` wins over this, and the backend wins over both.
   * @default 'hesna'
   */
  translator?: TranslatorId;

  /**
   * Form/Domain ID (fdid parameter). Set `translator` instead unless you are
   * working against a dictionary that is not in the bundled table.
   * @default '35'
   */
  fdid?: string;

  /**
   * Translation ID (tid parameter). Set `translator` instead unless you are
   * working against a translator that is not in the bundled table.
   * @default '43'
   */
  tid?: string;

  /**
   * Theme customization options
   */
  theme?: SignLanguageTheme;

  /**
   * Accessibility configuration
   */
  accessibility?: AccessibilityConfig;

  /**
   * Floating "tap-to-translate" button configuration.
   * The button appears while the SDK is enabled and lets the user toggle a mode
   * where tapping any on-screen text translates it instantly.
   */
  floatingButton?: FloatingButtonConfig;

  /**
   * Player appearance and controls.
   */
  card?: SignLanguageCardConfig;

  /**
   * Whether a tap translates the sentence under the finger or the whole
   * paragraph. `sentence` is never worse: whenever splitting yields a single
   * segment, or the tap cannot be mapped to a character, the whole paragraph
   * is translated anyway.
   * @default 'sentence'
   */
  granularity?: TranslationGranularity;

  /**
   * Longest text sent in one request. Derived from the transport, not from
   * taste: the text travels as a query parameter, and Turkish roughly doubles
   * under percent-encoding.
   * @default 900
   */
  maxSegmentChars?: number;

  /**
   * Whether a long press translates text the host app made tappable — the one
   * case a tap can never reach.
   * @default false
   */
  longPressToTranslate?: boolean;

  /**
   * Hand taps the SDK should not claim to the host app. Turning this off
   * restores v1 behavior, where the SDK claimed every tap.
   * @default true
   */
  smartPassthrough?: boolean;

  /**
   * Optional persistent key/value storage (e.g. AsyncStorage) for the two
   * playback preferences the user sets by hand — speed and loop. Without one
   * they are remembered for the current session only.
   */
  storage?: SignLanguageStorage;
}

/**
 * Minimal async key/value storage contract. Compatible with
 * `@react-native-async-storage/async-storage` out of the box.
 */
export interface SignLanguageStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * Corner placement for the floating button
 */
export type FloatingButtonPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

/**
 * Behavior of the floating button after a period of inactivity
 */
export type FloatingButtonIdleBehavior = 'peek' | 'fade' | 'none';

/**
 * Floating button customization options
 */
export interface FloatingButtonConfig {
  /**
   * Whether the floating button is shown while the SDK is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * @deprecated The button now starts on the middle of a side edge and only
   * sticks to the left/right edges, so this no longer affects the start.
   */
  position?: FloatingButtonPosition;

  /**
   * What the button does after it has been left untouched for `idleDelay` ms.
   * - `'peek'`: slides 35% off the docked edge and fades to 55% opacity.
   * - `'fade'`: fades to 55% opacity, stays fully on-screen.
   * - `'none'`: stays fully visible.
   * @default 'peek'
   */
  idleBehavior?: FloatingButtonIdleBehavior;

  /**
   * Milliseconds of inactivity before the idle behavior kicks in.
   * @default 2500
   */
  idleDelay?: number;

  /**
   * @deprecated Accepted but ignored. The SDK no longer shows a hint bubble;
   * the player itself is the affordance.
   */
  hintMaxShows?: number;

  /**
   * Diameter of the button in points
   * @default 44
   */
  size?: number;

  /**
   * Fill color when the tap-to-translate mode is OFF
   * @default '#FFFFFF'
   */
  backgroundColor?: string;

  /**
   * Fill color when the tap-to-translate mode is ON
   * @default theme.primaryColor
   */
  activeBackgroundColor?: string;

  /**
   * Logo tint when the mode is OFF
   * @default theme.primaryColor
   */
  iconColor?: string;

  /**
   * Logo tint when the mode is ON
   * @default '#FFFFFF'
   */
  activeIconColor?: string;

  /**
   * Border color (border is only drawn when the mode is OFF)
   * @default theme.primaryColor
   */
  borderColor?: string;
}

/**
 * Theme customization options.
 *
 * `onPrimaryColor` and `textColor` are never painted directly: they are read
 * through the contrast guard, which substitutes black or white when the
 * configured color fails WCAG 4.5:1 against the color behind it.
 */
export interface SignLanguageTheme {
  [key: string]: unknown;

  /**
   * Control bar fill, logo tint, active button fill, spinner.
   * @default '#6750A4'
   */
  primaryColor?: string;

  /**
   * Caption and in-stage messages, over the surface.
   * @default '#1C1B1F'
   */
  textColor?: string;

  /**
   * Anything drawn *on* the primary color — control icons, caption glyphs.
   * @default '#FFFFFF'
   */
  onPrimaryColor?: string;

  /**
   * Background behind the avatar video.
   * @default '#FFFFFF'
   */
  surfaceColor?: string;

  /**
   * Outer radius of the stage and the control bar.
   * @default 16
   */
  cornerRadius?: number;
}

/**
 * Whether a tap translates one sentence or the whole paragraph.
 */
export type TranslationGranularity = 'sentence' | 'paragraph';

/**
 * A translator that ships with the SDK. Naming one selects the ids it works
 * under, and the idle loop shows that same person.
 */
export type TranslatorId = 'kadir' | 'hesna' | 'jason' | 'owais';

/**
 * Which corner the player animates in from when no gesture decides it.
 */
export type CardCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/**
 * Player appearance and controls.
 *
 * `avatarHeight` and `avatarMaxWidth` are requests, not guarantees: the
 * player's real size comes from the screen-height budget, which can shrink
 * both.
 */
export interface SignLanguageCardConfig {
  /**
   * Whether the user can drag the player around.
   * @default true
   */
  draggable?: boolean;

  /**
   * Corner the player animates in from. The floating button's docked side
   * overrides the horizontal half when the player was opened by a gesture.
   * @default 'bottomRight'
   */
  initialCorner?: CardCorner;

  /**
   * Requested stage height; the width follows from the video aspect ratio.
   * @default 240
   */
  avatarHeight?: number;

  /**
   * Width ceiling, used when a video turns out landscape.
   * @default 212
   */
  avatarMaxWidth?: number;

  /**
   * Host-supplied idle clip, overriding the bundled one. An empty string opts
   * out of video entirely, leaving a plain spinner.
   * @default null
   */
  placeholderAsset?: string | null;

  /**
   * The thumbs-up/down pill over the avatar. Off because it competes with the
   * avatar for space *and* because its endpoint is not live yet.
   * @default false
   */
  showFeedback?: boolean;

  /**
   * Contact button in the control bar. Off for the same reasons.
   * @default false
   */
  showContact?: boolean;

  /**
   * Speed cycling button.
   * @default true
   */
  showSpeed?: boolean;

  /**
   * Loop toggle.
   * @default true
   */
  showLoop?: boolean;

  /**
   * Cycle order of the speed button.
   * @default [1.0, 1.2, 1.5, 2.0]
   */
  speeds?: number[];

  /**
   * Speed for a user with no stored preference.
   * @default 1.0
   */
  defaultSpeed?: number;

  /**
   * Loop setting for a user with no stored preference.
   * @default true
   */
  defaultLooping?: boolean;

  /**
   * A blur component for the loading veil, e.g. `BlurView` from
   * `@react-native-community/blur`.
   *
   * Injected rather than imported: React Native has no built-in blur, and a
   * library that `require`s a package the host has not installed corrupts its
   * own bundle. Without one the veil falls back to a translucent scrim, which
   * reads as "not the final video" just as well.
   *
   * It is rendered with `style`, `blurAmount`, `blurType` and
   * `reducedTransparencyFallbackColor`.
   */
  blurComponent?: React.ComponentType<any>;
}

/**
 * Accessibility configuration options
 */
export interface AccessibilityConfig {
  [key: string]: unknown;
  /**
   * Whether to announce when the bottom sheet opens
   * @default true
   */
  announceOnOpen?: boolean;

  /**
   * Whether to announce when the bottom sheet closes
   * @default false
   */
  announceOnClose?: boolean;

  /**
   * Custom accessibility label for the video player
   */
  videoPlayerLabel?: string;

  /**
   * Custom accessibility label for the close button
   */
  closeButtonLabel?: string;

  /**
   * Custom accessibility hint for the bottom sheet
   */
  bottomSheetHint?: string;
}

/**
 * Current state of the Sign Language SDK
 */
export interface SignLanguageState {
  /**
   * Whether the SDK has been configured successfully
   */
  isConfigured: boolean;

  /**
   * Whether the SDK is currently enabled
   */
  isEnabled: boolean;

  /**
   * Whether a translation is currently in progress
   */
  isLoading: boolean;

  /**
   * Whether the bottom sheet is currently visible
   */
  isBottomSheetVisible: boolean;

  /**
   * The text currently being translated or displayed
   */
  currentText?: string;

  /**
   * Current error if any
   */
  error?: SignLanguageError;
}

/**
 * Error object for Sign Language SDK errors
 */
export interface SignLanguageError {
  /**
   * Error code for programmatic handling
   */
  code: SignLanguageErrorCode;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Additional error details
   */
  details?: Record<string, unknown>;
}

/**
 * Possible error codes
 */
export type SignLanguageErrorCode =
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'VIDEO_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'CANCELLED'
  | 'UNKNOWN';

/**
 * The translation state machine. Exactly one state is active at any time.
 */
export type TranslationState =
  /** Nothing in flight, nothing to play. Idle signer loop, unblurred. */
  | 'idle'
  /** A translation is in flight. Idle loop, blurred, spinner over it. */
  | 'loading'
  /** A video is playable. Controls live. */
  | 'ready'
  /** The request or the video failed. Message inside the stage. */
  | 'error'
  /** The text was refused as sensitive. Message inside the stage. */
  | 'blocked';

/**
 * Event types emitted by the Sign Language SDK.
 *
 * The `onBottomSheet*` names are v1 aliases, emitted alongside their v2
 * equivalents so existing integrations keep working unchanged.
 */
export type SignLanguageEventType =
  // Text lifecycle
  | 'blockedSensitive'
  | 'textSelected'
  | 'translationStart'
  | 'translationError'
  | 'translationComplete'
  // Player and playback
  | 'panelOpen'
  | 'panelClose'
  | 'videoStart'
  | 'videoEnd'
  | 'segmentChanged'
  | 'playbackSpeedChanged'
  | 'cardCollapsed'
  // Side channels
  | 'feedbackSent'
  | 'contactRequested'
  // v1 aliases, kept for backward compatibility
  | 'onTextSelected'
  | 'onTranslationStart'
  | 'onTranslationComplete'
  | 'onTranslationError'
  | 'onBottomSheetOpen'
  | 'onBottomSheetClose'
  | 'onVideoStart'
  | 'onVideoEnd'
  | 'onVideoError';

/**
 * Event object emitted by the Sign Language SDK
 */
export interface SignLanguageEvent<T = unknown> {
  /**
   * Type of the event
   */
  type: SignLanguageEventType;

  /**
   * Event payload data
   */
  payload?: T;

  /**
   * Timestamp when the event occurred
   */
  timestamp: number;
}

/**
 * Payload for text selection events
 */
export interface TextSelectedPayload {
  text: string;
}

/**
 * Payload for translation complete events
 */
export interface TranslationCompletePayload {
  text: string;
  videoUrl: string;
}

/**
 * Payload for translation error events
 */
export interface TranslationErrorPayload {
  code: SignLanguageErrorCode;
  message: string;
}

/**
 * Sign Model response from the API
 */
export interface SignModel {
  state: boolean | null;
  baseUrl: string | null;
  name: string | null;
  cid: string | null;
  st: boolean | null;
}

/**
 * Native module specification (for TurboModule compatibility)
 */
export interface SignLanguageNativeSpec {
  configure(
    apiKey: string,
    apiUrl: string,
    language: string,
    fdid: string,
    tid: string,
    theme: Record<string, unknown>,
    accessibility: Record<string, unknown>
  ): Promise<void>;

  enable(): void;
  disable(): void;
  isEnabled(): Promise<boolean>;

  setTapToTranslateMode(enabled: boolean): void;

  enableTextSelectionForActivity(): void;
  enableTextSelectionForView(viewTag: number): void;

  translateText(text: string): Promise<void>;
  cancelTranslation(): void;

  showBottomSheet(videoUrl: string, text: string): Promise<void>;
  dismissBottomSheet(): void;
  isBottomSheetVisible(): Promise<boolean>;

  addListener(eventType: string): void;
  removeListeners(count: number): void;
}
