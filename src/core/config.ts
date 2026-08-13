import type React from 'react';
/**
 * Configuration.
 *
 * Defaults matter more than usual here: most integrations set only the
 * credentials, so the defaults *are* the product for them.
 *
 * The resolved configuration lives in one process-wide instance, not one per
 * player. Two SDK mount points in one app share it. This is deliberate — the
 * backend can override `tid`/`fdid` mid-session, and every later request must
 * use the corrected pair, wherever it originates.
 */

import type {
  CardCorner,
  FloatingButtonIdleBehavior,
  Language,
  SignLanguageCardConfig,
  SignLanguageConfig,
  SignLanguageTheme,
  TranslationGranularity,
} from '../types';
import { SIGNERS } from './signers';
import { FLOATING_BUTTON, RADIUS } from './tokens';

/** Numeric language codes the backend understands. */
export const LANGUAGE_CODES: Record<Language, string> = {
  tr: '1',
  en: '2',
  de: '3',
  fr: '4',
  es: '5',
  ar: '6',
};

/**
 * The three the backend actually serves. `3`–`5` exist in the numbering
 * scheme but are not supported, so a port must not offer them.
 */
export const SUPPORTED_LANGUAGE_CODES = ['1', '2', '6'] as const;

export const languageCode = (language: Language): string =>
  LANGUAGE_CODES[language] ?? LANGUAGE_CODES.tr;

export interface ResolvedTheme
  extends Required<Omit<SignLanguageTheme, string>> {
  primaryColor: string;
  textColor: string;
  onPrimaryColor: string;
  surfaceColor: string;
  cornerRadius: number;
}

export const DEFAULT_THEME: ResolvedTheme = {
  primaryColor: '#6750A4',
  textColor: '#1C1B1F',
  onPrimaryColor: '#FFFFFF',
  surfaceColor: '#FFFFFF',
  cornerRadius: RADIUS.large,
};

export interface ResolvedFloatingButton {
  enabled: boolean;
  idleBehavior: FloatingButtonIdleBehavior;
  idleDelayMs: number;
  hintMaxShows: number;
  size: number;
  backgroundColor?: string;
  activeBackgroundColor?: string;
  iconColor?: string;
  activeIconColor?: string;
  borderColor?: string;
}

export const DEFAULT_FLOATING_BUTTON: ResolvedFloatingButton = {
  enabled: true,
  idleBehavior: 'peek',
  idleDelayMs: FLOATING_BUTTON.idleDelayMs,
  hintMaxShows: 2,
  size: FLOATING_BUTTON.size,
};

export interface ResolvedCard {
  draggable: boolean;
  initialCorner: CardCorner;
  avatarHeight: number;
  avatarMaxWidth: number;
  placeholderAsset: string | null;
  showFeedback: boolean;
  showContact: boolean;
  showSpeed: boolean;
  showLoop: boolean;
  speeds: number[];
  defaultSpeed: number;
  defaultLooping: boolean;
  blurComponent?: React.ComponentType<any>;
}

export const DEFAULT_CARD: ResolvedCard = {
  draggable: true,
  initialCorner: 'bottomRight',
  avatarHeight: 240,
  avatarMaxWidth: 212,
  placeholderAsset: null,
  // Both off: they compete with the avatar for space, and the endpoints they
  // report to are not live yet.
  showFeedback: false,
  showContact: false,
  showSpeed: true,
  showLoop: true,
  speeds: [1.0, 1.2, 1.5, 2.0],
  defaultSpeed: 1.0,
  defaultLooping: true,
};

export interface ResolvedAccessibility {
  announceOnOpen: boolean;
  announceOnClose: boolean;
  videoPlayerLabel?: string;
  closeButtonLabel?: string;
  bottomSheetHint?: string;
}

export const DEFAULT_ACCESSIBILITY: ResolvedAccessibility = {
  announceOnOpen: true,
  announceOnClose: false,
};

export interface ResolvedConfig {
  apiKey: string;
  apiUrl: string;
  /** Always concrete: falls back to `apiUrl` when no `originUrl` was given. */
  originUrl: string;
  language: Language;
  fdid: string;
  tid: string;
  theme: ResolvedTheme;
  floatingButton: ResolvedFloatingButton;
  card: ResolvedCard;
  accessibility: ResolvedAccessibility;
  granularity: TranslationGranularity;
  maxSegmentChars: number;
  longPressToTranslate: boolean;
  smartPassthrough: boolean;
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  apiKey: '',
  apiUrl: '',
  originUrl: '',
  language: 'tr',
  // This pair is Hesna. It is also the stand-in the signer ladder falls back to
  //, so the default and the fallback agree — one less way for the
  // idle loop and the translation to show two different people.
  fdid: '35',
  tid: '43',
  theme: DEFAULT_THEME,
  floatingButton: DEFAULT_FLOATING_BUTTON,
  card: DEFAULT_CARD,
  accessibility: DEFAULT_ACCESSIBILITY,
  granularity: 'sentence',
  maxSegmentChars: 900,
  longPressToTranslate: false,
  smartPassthrough: true,
};

/** Drop keys whose value is `undefined` so they do not clobber a default. */
const defined = <T extends object>(source: T | undefined): Partial<T> => {
  if (!source) return {};
  const out: Partial<T> = {};
  for (const key of Object.keys(source) as (keyof T)[]) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
};

export const resolveTheme = (theme?: SignLanguageTheme): ResolvedTheme => ({
  ...DEFAULT_THEME,
  ...(defined(theme) as Partial<ResolvedTheme>),
});

export const resolveCard = (card?: SignLanguageCardConfig): ResolvedCard => ({
  ...DEFAULT_CARD,
  ...(defined(card) as Partial<ResolvedCard>),
});

/**
 * Resolve a host-supplied configuration into a complete one.
 *
 * Every unset field takes its documented default, so the result can be read
 * without optional chaining anywhere downstream.
 *
 * `translator` is resolved here and nowhere else: it becomes a `tid`/`fdid`
 * pair and then stops existing. Downstream there is exactly one answer to
 * *which translator is in effect* — the pair — which is also the only thing the
 * backend can override. An unknown name is ignored rather than fatal, because
 * a JavaScript host gets no type to check it against.
 */
export const resolveConfig = (config: SignLanguageConfig): ResolvedConfig => {
  const apiUrl = config.apiUrl ?? '';
  const { floatingButton, accessibility } = config;
  const translator = config.translator ? SIGNERS[config.translator] : undefined;

  return {
    ...DEFAULT_CONFIG,
    ...defined({
      apiKey: config.apiKey,
      apiUrl,
      language: config.language,
      // Explicit ids win over the name: they are the lower-level control, and
      // a host that sets both is asking for a pair outside the table.
      fdid: config.fdid ?? translator?.fdid,
      tid: config.tid ?? translator?.tid,
      granularity: config.granularity,
      maxSegmentChars: config.maxSegmentChars,
      longPressToTranslate: config.longPressToTranslate,
      smartPassthrough: config.smartPassthrough,
    }),
    // The origin identifies the calling app; when it is not given the API URL
    // stands in, and both the header and the query parameter use that value.
    originUrl: config.originUrl || apiUrl,
    theme: resolveTheme(config.theme),
    card: resolveCard(config.card),
    floatingButton: {
      ...DEFAULT_FLOATING_BUTTON,
      ...defined({
        enabled: floatingButton?.enabled,
        idleBehavior: floatingButton?.idleBehavior,
        // Accept the documented `idleDelay` spelling from the v1 surface.
        idleDelayMs: floatingButton?.idleDelay,
        hintMaxShows: floatingButton?.hintMaxShows,
        size: floatingButton?.size,
        backgroundColor: floatingButton?.backgroundColor,
        activeBackgroundColor: floatingButton?.activeBackgroundColor,
        iconColor: floatingButton?.iconColor,
        activeIconColor: floatingButton?.activeIconColor,
        borderColor: floatingButton?.borderColor,
      }),
    },
    accessibility: {
      ...DEFAULT_ACCESSIBILITY,
      ...defined({
        announceOnOpen: accessibility?.announceOnOpen as boolean | undefined,
        announceOnClose: accessibility?.announceOnClose as boolean | undefined,
        videoPlayerLabel: accessibility?.videoPlayerLabel as string | undefined,
        closeButtonLabel: accessibility?.closeButtonLabel as string | undefined,
        bottomSheetHint: accessibility?.bottomSheetHint as string | undefined,
      }),
    },
  };
};

// ---------------------------------------------------------------------------
// Process-global instance
// ---------------------------------------------------------------------------

type Listener = () => void;

let current: ResolvedConfig = DEFAULT_CONFIG;
const listeners = new Set<Listener>();

/**
 * The ids the backend has served, if it has served any.
 *
 * **The backend is the topmost authority on which translator is in effect.**
 * Once it has answered under a pair, that pair holds for the rest of the
 * session and nothing may override it — not a later `configure()`, not a
 * runtime setter. Anything else would send the *next* request under a
 * translator the backend has already told us it will not use, and would swap
 * the idle signer out from under a user mid-session.
 *
 * Held apart from `current` precisely so re-resolving a host config cannot
 * quietly drop it.
 */
let served: { tid?: string; fdid?: string } = {};

const notify = () => {
  listeners.forEach((listener) => listener());
};

/** Re-apply the backend's ids over a freshly resolved config. */
const withServedIds = (config: ResolvedConfig): ResolvedConfig => ({
  ...config,
  ...(served.tid ? { tid: served.tid } : {}),
  ...(served.fdid ? { fdid: served.fdid } : {}),
});

export const getConfig = (): ResolvedConfig => current;

/** Whether the backend has named the translator for this session. */
export const hasServedIds = (): boolean => !!(served.tid || served.fdid);

export const setConfig = (config: SignLanguageConfig): ResolvedConfig => {
  current = withServedIds(resolveConfig(config));
  notify();
  return current;
};

/**
 * A runtime setter over the already-resolved configuration.
 *
 * There is one for every field, taking effect from the next read. This
 * is the single implementation of that, working on the resolved shape so a
 * caller never has to reconstruct a host-facing config object.
 */
export const updateConfig = (
  patch: Partial<ResolvedConfig>
): ResolvedConfig => {
  // The served ids win over this too: a host changing the language must not
  // silently take the translator back off the backend.
  current = withServedIds({ ...current, ...patch });
  notify();
  return current;
};

/**
 * Adopt the translator and dictionary ids a response came back under.
 *
 * The backend may serve a translation under a different pair than requested —
 * an account can be pinned to a different translator or dictionary than the app
 * asked for. It is the **final** authority: from here on, every request goes out
 * under this pair and the idle loop shows this signer, for the rest of the
 * session.
 *
 * Absent, empty and unchanged values change nothing, and each id is honoured on
 * its own. Returns whether anything actually changed, so the caller can skip a
 * needless notification.
 */
export const adoptServedIds = (ids: {
  tid?: string | null;
  fdid?: string | null;
}): boolean => {
  const tid = ids.tid?.trim();
  const fdid = ids.fdid?.trim();

  const nextTid = tid && tid !== current.tid ? tid : undefined;
  const nextFdid = fdid && fdid !== current.fdid ? fdid : undefined;
  if (!nextTid && !nextFdid) return false;

  // Remembered separately from `current` so that re-resolving a host config
  // cannot drop it.
  served = {
    ...served,
    ...(nextTid ? { tid: nextTid } : {}),
    ...(nextFdid ? { fdid: nextFdid } : {}),
  };

  current = withServedIds(current);
  // Adopting ids must notify the UI, so the idle loop updates without waiting
  // for the next state change.
  notify();
  return true;
};

export const subscribeToConfig = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Restore the process-global config to its defaults. Exported for tests. */
export const resetConfig = (): void => {
  current = DEFAULT_CONFIG;
  // The served pair is session state, and this ends the session.
  served = {};
  notify();
};
