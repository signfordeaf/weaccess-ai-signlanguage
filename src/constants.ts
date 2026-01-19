import type { Language, SignLanguageTheme } from './types';

/**
 * Supported languages for sign language translation
 */
export const SUPPORTED_LANGUAGES: Record<Language, { code: string; name: string }> = {
  tr: { code: '1', name: 'Türkçe' },
  en: { code: '2', name: 'English' },
  de: { code: '3', name: 'Deutsch' },
  fr: { code: '4', name: 'Français' },
  es: { code: '5', name: 'Español' },
  ar: { code: '6', name: 'العربية' },
};

/**
 * Default theme configuration
 */
export const DEFAULT_THEME: Required<SignLanguageTheme> = {
  primaryColor: '#6750A4',
  backgroundColor: '#FFFFFF',
  textColor: '#6750A4',
  closeButtonColor: '#6750A4',
  videoBackgroundColor: '#000000',
};

/**
 * Localized strings for each language
 */
export const LOCALIZED_STRINGS: Record<
  Language,
  {
    menuTitle: string;
    businessName: string;
    loading: string;
    error: string;
    close: string;
    videoPlayerLabel: string;
    translationReady: string;
  }
> = {
  tr: {
    menuTitle: 'İşaret Dili',
    businessName: 'Engelsiz Çeviri',
    loading: 'Çeviriliyor...',
    error: 'Çeviri işlemi şu anda gerçekleştirilemiyor. Lütfen daha sonra tekrar deneyiniz.',
    close: 'Kapat',
    videoPlayerLabel: 'İşaret dili videosu oynatılıyor',
    translationReady: 'İşaret dili çevirisi hazır',
  },
  en: {
    menuTitle: 'Sign Language',
    businessName: 'SignForDeaf',
    loading: 'Translating...',
    error: 'Translation is not available at the moment. Please try again later.',
    close: 'Close',
    videoPlayerLabel: 'Sign language video is playing',
    translationReady: 'Sign language translation is ready',
  },
  de: {
    menuTitle: 'Gebärdensprache',
    businessName: 'SignForDeaf',
    loading: 'Übersetzen...',
    error: 'Die Übersetzung ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.',
    close: 'Schließen',
    videoPlayerLabel: 'Gebärdensprachvideo wird abgespielt',
    translationReady: 'Gebärdensprachübersetzung ist bereit',
  },
  fr: {
    menuTitle: 'Langue des signes',
    businessName: 'SignForDeaf',
    loading: 'Traduction en cours...',
    error: 'La traduction n\'est pas disponible pour le moment. Veuillez réessayer plus tard.',
    close: 'Fermer',
    videoPlayerLabel: 'Vidéo en langue des signes en cours de lecture',
    translationReady: 'Traduction en langue des signes prête',
  },
  es: {
    menuTitle: 'Lengua de señas',
    businessName: 'SignForDeaf',
    loading: 'Traduciendo...',
    error: 'La traducción no está disponible en este momento. Por favor, inténtelo de nuevo más tarde.',
    close: 'Cerrar',
    videoPlayerLabel: 'Se está reproduciendo el video en lengua de señas',
    translationReady: 'La traducción en lengua de señas está lista',
  },
  ar: {
    menuTitle: 'لغة الإشارة',
    businessName: 'SignForDeaf',
    loading: 'جارٍ الترجمة...',
    error: 'لا يمكن إجراء عملية الترجمة في الوقت الحالي. يرجى المحاولة مرة أخرى في وقت لاحق.',
    close: 'إغلاق',
    videoPlayerLabel: 'يتم تشغيل فيديو لغة الإشارة',
    translationReady: 'ترجمة لغة الإشارة جاهزة',
  },
};

/**
 * API constants
 */
export const API_CONSTANTS = {
  TRANSLATE_ENDPOINT: '/Translate',
  RETRY_DELAY_MS: 1000,
  MAX_RETRIES: 10,
  DICTIONARY_ID: '16',
  TRANSLATOR_ID: '23',
};

/**
 * Event names
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
