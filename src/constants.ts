/**
 * Backward-compatible constants.
 *
 * The values themselves now live in `core/`, where they are organised by the
 * document that specifies them. This module keeps the v1 export names working
 * so existing integrations do not have to change an import.
 */

import type { Language, SignLanguageTheme } from './types';
import {
  DEFAULT_THEME as RESOLVED_DEFAULT_THEME,
  LANGUAGE_CODES,
} from './core/config';
import { STRINGS, type SignLanguageStrings } from './core/strings';

/**
 * Supported languages for sign language translation.
 *
 * Note that only `tr`, `en` and `ar` are served by the backend. `de`, `fr` and
 * `es` exist in the numbering scheme, are accepted as configuration values for
 * backward compatibility, and fall back to the English string table.
 */
export const SUPPORTED_LANGUAGES: Record<
  Language,
  { code: string; name: string; supported: boolean }
> = {
  tr: { code: LANGUAGE_CODES.tr, name: 'Türkçe', supported: true },
  en: { code: LANGUAGE_CODES.en, name: 'English', supported: true },
  ar: { code: LANGUAGE_CODES.ar, name: 'العربية', supported: true },
  de: { code: LANGUAGE_CODES.de, name: 'Deutsch', supported: false },
  fr: { code: LANGUAGE_CODES.fr, name: 'Français', supported: false },
  es: { code: LANGUAGE_CODES.es, name: 'Español', supported: false },
};

/**
 * Default theme.
 *
 * The three legacy keys are kept so a v1 config object still type-checks; the
 * player reads `surfaceColor` where it used to read `backgroundColor`, and
 * draws the close glyph in `onPrimaryColor` rather than `closeButtonColor`.
 */
export const DEFAULT_THEME: SignLanguageTheme = {
  ...RESOLVED_DEFAULT_THEME,

  /** @deprecated Use `surfaceColor`. */
  backgroundColor: RESOLVED_DEFAULT_THEME.surfaceColor,
  /** @deprecated Use `onPrimaryColor`. */
  closeButtonColor: RESOLVED_DEFAULT_THEME.primaryColor,
  /** @deprecated The stage draws on `surfaceColor`. */
  videoBackgroundColor: '#000000',
};

/**
 * Localized strings, keyed by language.
 *
 * `de`, `fr` and `es` resolve to the English table — see the note on
 * {@link SUPPORTED_LANGUAGES}.
 */
export const LOCALIZED_STRINGS: Record<Language, SignLanguageStrings> = {
  tr: STRINGS.tr,
  en: STRINGS.en,
  ar: STRINGS.ar,
  de: STRINGS.en,
  fr: STRINGS.en,
  es: STRINGS.en,
};

/**
 * API constants.
 */
export const API_CONSTANTS = {
  TRANSLATE_ENDPOINT: '/Translate',
  FEEDBACK_ENDPOINT: '/Feedback',
  CONTACT_ENDPOINT: '/Contact',
  RETRY_DELAY_MS: 1000,
  MAX_RETRIES: 30,
  TIMEOUT_MS: 30000,
  DICTIONARY_ID: '35',
  TRANSLATOR_ID: '43',
} as const;

/**
 * v1 event names, kept as aliases of the v2 catalogue. Each is emitted
 * alongside its v2 equivalent.
 */
export const EVENT_NAMES = {
  TEXT_SELECTED: 'onTextSelected',
  TRANSLATION_START: 'onTranslationStart',
  TRANSLATION_COMPLETE: 'onTranslationComplete',
  TRANSLATION_ERROR: 'onTranslationError',
  BOTTOM_SHEET_OPEN: 'onBottomSheetOpen',
  BOTTOM_SHEET_CLOSE: 'onBottomSheetClose',
  VIDEO_START: 'onVideoStart',
  VIDEO_END: 'onVideoEnd',
  VIDEO_ERROR: 'onVideoError',
} as const;
