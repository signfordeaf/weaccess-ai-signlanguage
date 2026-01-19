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
   * @example 'https://kor01rp02.signfordeaf.com'
   */
  apiUrl: string;

  /**
   * Language for the sign language translation
   * @default 'tr'
   */
  language?: Language;

  /**
   * Form/Domain ID (fdid parameter)
   * @default '16'
   */
  fdid?: string;

  /**
   * Translation ID (tid parameter)
   * @default '23'
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
}

/**
 * Theme customization options
 */
export interface SignLanguageTheme {
  [key: string]: unknown;
  /**
   * Primary color for the bottom sheet header and text
   * @default '#6750A4'
   */
  primaryColor?: string;

  /**
   * Background color for the bottom sheet
   * @default '#FFFFFF'
   */
  backgroundColor?: string;

  /**
   * Text color for the displayed text
   * @default '#6750A4'
   */
  textColor?: string;

  /**
   * Close button color
   * @default '#6750A4'
   */
  closeButtonColor?: string;

  /**
   * Video container background color
   * @default '#000000'
   */
  videoBackgroundColor?: string;
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
 * Event types emitted by the Sign Language SDK
 */
export type SignLanguageEventType =
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
