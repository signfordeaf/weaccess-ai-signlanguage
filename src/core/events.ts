/**
 * The lifecycle event stream.
 *
 * Events are **observational**: nothing in the SDK depends on a host consuming
 * them. Hosts use them to log translations, drive analytics, or build their own
 * UI around the controller.
 */

import type {
  SignLanguageError,
  SignLanguageErrorCode,
  SignLanguageEventType,
} from '../types';

/** The v2 event names. The `on*` spellings are v1 aliases of these. */
export type SignEventType =
  | 'blockedSensitive'
  | 'textSelected'
  | 'translationStart'
  | 'translationError'
  | 'translationComplete'
  | 'panelOpen'
  | 'panelClose'
  | 'videoStart'
  | 'videoEnd'
  | 'segmentChanged'
  | 'playbackSpeedChanged'
  | 'cardCollapsed'
  | 'feedbackSent'
  | 'contactRequested';

export interface SignEvent {
  type: SignEventType;
  /** The text-related events. */
  text?: string;
  /** `translationComplete` and `videoStart`. */
  videoUrl?: string;
  /** `translationError` only. */
  error?: SignLanguageError;
  /**
   * Free-form, per event: the new index on `segmentChanged`, the new speed on
   * `playbackSpeedChanged`, the collapsed flag on `cardCollapsed`, the
   * positive flag on `feedbackSent`.
   */
  value?: unknown;
  /** Whenever a translation id is known. */
  cid?: string;
  timestamp: number;
}

/**
 * v1 aliases. Each v2 event that had a v1 name emits under both, so an
 * integration listening for `onTranslationComplete` keeps working.
 *
 * `videoError` is deliberately absent: video failures arrive as
 * `translationError` carrying the `videoError` code, which is what the
 * reference implementation does.
 */
const LEGACY_ALIASES: Partial<Record<SignEventType, SignLanguageEventType>> = {
  textSelected: 'onTextSelected',
  translationStart: 'onTranslationStart',
  translationComplete: 'onTranslationComplete',
  translationError: 'onTranslationError',
  panelOpen: 'onBottomSheetOpen',
  panelClose: 'onBottomSheetClose',
  videoStart: 'onVideoStart',
  videoEnd: 'onVideoEnd',
};

export const legacyAliasFor = (
  type: SignEventType
): SignLanguageEventType | undefined => LEGACY_ALIASES[type];

export type SignEventListener = (event: SignEvent) => void;

/**
 * A closable event stream.
 *
 * Emitting to a closed stream is a no-op rather than an error: the SDK can be
 * disposed while a late callback is still in flight, and that must not crash
 * the host app.
 */
export class SignEventEmitter {
  private byType = new Map<string, Set<SignEventListener>>();
  private all = new Set<SignEventListener>();
  private closed = false;

  /** Listen to one event type, by either its v2 name or its v1 alias. */
  on(type: SignLanguageEventType, listener: SignEventListener): () => void {
    if (this.closed) return () => {};

    let set = this.byType.get(type);
    if (!set) {
      set = new Set();
      this.byType.set(type, set);
    }
    set.add(listener);

    return () => {
      set?.delete(listener);
    };
  }

  /** Listen to every event. */
  onAny(listener: SignEventListener): () => void {
    if (this.closed) return () => {};
    this.all.add(listener);
    return () => {
      this.all.delete(listener);
    };
  }

  emit(
    type: SignEventType,
    payload: Omit<SignEvent, 'type' | 'timestamp'> = {}
  ): void {
    if (this.closed) return;

    const event: SignEvent = { ...payload, type, timestamp: Date.now() };

    this.deliver(this.byType.get(type), event);

    const alias = LEGACY_ALIASES[type];
    if (alias) this.deliver(this.byType.get(alias), event);

    this.deliver(this.all, event);
  }

  private deliver(
    listeners: Set<SignEventListener> | undefined,
    event: SignEvent
  ) {
    if (!listeners?.size) return;
    // Copy before iterating: a listener may unsubscribe itself.
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (error) {
        // A misbehaving host listener may not break the translation flow.
        if (__DEV__) {
          console.warn(
            `[SignLanguage] listener for "${event.type}" threw`,
            error
          );
        }
      }
    }
  }

  close(): void {
    this.closed = true;
    this.byType.clear();
    this.all.clear();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

/** Build an error payload with a message meant for logs, never for the user. */
export const signError = (
  code: SignLanguageErrorCode,
  message: string,
  details?: Record<string, unknown>
): SignLanguageError => ({ code, message, details });
