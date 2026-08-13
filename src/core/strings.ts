/**
 * Localization.
 *
 * An accessibility SDK that ships a hardcoded label is a contradiction. Every
 * user-visible string, including every screen-reader label, is localized.
 *
 * German, French and Spanish tables are intentionally absent: the backend does
 * not support those languages, so offering them would promise a translation
 * that never arrives. They stay accepted as configuration values — an existing
 * integration must not stop compiling — and fall back to English.
 */

import type { Language } from '../types';

/** The languages that actually have a string table. */
export type LocalizedLanguage = 'tr' | 'en' | 'ar';

export interface SignLanguageStrings {
  /** Title of the "Sign Language" text-selection menu item. */
  menuTitle: string;
  businessName: string;
  /**
   * Currently unused by the UI — the player shows no "translating" label, on
   * purpose. Kept for hosts building their own controls.
   */
  loading: string;
  /** The generic failure message. The raw error is never shown to the user. */
  error: string;
  close: string;
  videoPlayerLabel: string;
  translationReady: string;
  /**
   * Unused by the UI — the SDK shows no hint bubble; the player itself is the
   * affordance. Kept for hosts that want to teach the gesture their own way.
   */
  tapToTranslateHint: string;
  sensitiveBlocked: string;
  translationModeLabel: string;
  playLabel: string;
  pauseLabel: string;
  loopLabel: string;
  speedLabel: string;
  contactLabel: string;
  collapseLabel: string;
  expandLabel: string;
  /** Unused by the UI — there is no on-screen sentence navigation. */
  previousSentenceLabel: string;
  /** Unused by the UI, for the same reason. */
  nextSentenceLabel: string;
  feedbackPositiveLabel: string;
  feedbackNegativeLabel: string;
  feedbackThanks: string;
}

export const STRINGS: Record<LocalizedLanguage, SignLanguageStrings> = {
  tr: {
    menuTitle: 'İşaret Dili',
    businessName: 'Engelsiz Çeviri',
    loading: 'Çeviriliyor...',
    error:
      'Çeviri işlemi şu anda gerçekleştirilemiyor. Lütfen daha sonra tekrar deneyiniz.',
    close: 'Kapat',
    videoPlayerLabel: 'İşaret dili videosu oynatılıyor',
    translationReady: 'İşaret dili çevirisi hazır',
    tapToTranslateHint:
      'Cümlelere tıklayarak işaret dili çevirilerini başlatabilirsiniz.',
    sensitiveBlocked:
      'Bu içerik hassas veri içerdiği için işaret diline çevrilemez.',
    translationModeLabel: 'İşaret dili çeviri modu',
    playLabel: 'Oynat',
    pauseLabel: 'Duraklat',
    loopLabel: 'Tekrarla',
    speedLabel: 'Oynatma hızı',
    contactLabel: 'İletişime geçin',
    collapseLabel: 'Küçült',
    expandLabel: 'Genişlet',
    previousSentenceLabel: 'Önceki cümle',
    nextSentenceLabel: 'Sonraki cümle',
    feedbackPositiveLabel: 'Çeviri anlaşılır',
    feedbackNegativeLabel: 'Çeviri anlaşılır değil',
    feedbackThanks: 'Geri bildiriminiz için teşekkürler',
  },
  en: {
    menuTitle: 'Sign Language',
    businessName: 'SignForDeaf',
    loading: 'Translating...',
    error:
      'Translation is not available at the moment. Please try again later.',
    close: 'Close',
    videoPlayerLabel: 'Sign language video is playing',
    translationReady: 'Sign language translation is ready',
    tapToTranslateHint:
      'Tap a sentence to start its sign language translation.',
    sensitiveBlocked:
      'This content contains sensitive data and cannot be translated.',
    translationModeLabel: 'Sign language translation mode',
    playLabel: 'Play',
    pauseLabel: 'Pause',
    loopLabel: 'Repeat',
    speedLabel: 'Playback speed',
    contactLabel: 'Contact us',
    collapseLabel: 'Collapse',
    expandLabel: 'Expand',
    previousSentenceLabel: 'Previous sentence',
    nextSentenceLabel: 'Next sentence',
    feedbackPositiveLabel: 'Translation is clear',
    feedbackNegativeLabel: 'Translation is unclear',
    feedbackThanks: 'Thanks for your feedback',
  },
  ar: {
    menuTitle: 'لغة الإشارة',
    businessName: 'SignForDeaf',
    loading: 'جارٍ الترجمة...',
    error:
      'لا يمكن إجراء عملية الترجمة في الوقت الحالي. يرجى المحاولة مرة أخرى في وقت لاحق.',
    close: 'إغلاق',
    videoPlayerLabel: 'يتم تشغيل فيديو لغة الإشارة',
    translationReady: 'ترجمة لغة الإشارة جاهزة',
    tapToTranslateHint: 'انقر على جملة لبدء ترجمتها إلى لغة الإشارة.',
    sensitiveBlocked: 'يحتوي هذا المحتوى على بيانات حساسة ولا يمكن ترجمته.',
    translationModeLabel: 'وضع الترجمة بلغة الإشارة',
    playLabel: 'تشغيل',
    pauseLabel: 'إيقاف مؤقت',
    loopLabel: 'تكرار',
    speedLabel: 'سرعة التشغيل',
    contactLabel: 'تواصل معنا',
    collapseLabel: 'تصغير',
    expandLabel: 'توسيع',
    previousSentenceLabel: 'الجملة السابقة',
    nextSentenceLabel: 'الجملة التالية',
    feedbackPositiveLabel: 'الترجمة واضحة',
    feedbackNegativeLabel: 'الترجمة غير واضحة',
    feedbackThanks: 'شكرًا على ملاحظاتك',
  },
};

/** Arabic renders right-to-left; the SDK must supply its own direction. */
export const isRtl = (language: Language): boolean =>
  resolveLocalizedLanguage(language) === 'ar';

/**
 * Map any configured language onto a table that exists. German, French and
 * Spanish resolve to English rather than to Turkish, because a host that set
 * one of them chose a European language explicitly.
 */
export const resolveLocalizedLanguage = (
  language: Language | string | undefined
): LocalizedLanguage => {
  switch (language) {
    case 'tr':
      return 'tr';
    case 'ar':
      return 'ar';
    case 'en':
    case 'de':
    case 'fr':
    case 'es':
      return 'en';
    default:
      return 'tr';
  }
};

export const stringsFor = (
  language: Language | string | undefined
): SignLanguageStrings => STRINGS[resolveLocalizedLanguage(language)];

/**
 * The sentence counter, "{index + 1} / {total}".
 *
 * Unused by the player — there is no on-screen sentence navigation — and
 * kept for hosts that build their own controls.
 */
export const sentenceCounterLabel = (index: number, total: number): string =>
  `${index + 1} / ${total}`;
