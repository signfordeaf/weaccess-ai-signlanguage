/**
 * The controller.
 *
 * All state and every action; the single source of truth. Views call actions,
 * the controller mutates state and notifies, views re-render from that state.
 * Views must not hold translation state of their own — v1 bugs like the
 * floating button forgetting its position came from exactly that.
 *
 * Deliberately free of React and of any native call, so the whole state
 * machine is testable on its own.
 */

import type {
  Language,
  SignLanguageConfig,
  SignLanguageError,
  SignLanguageErrorCode,
  SignLanguageStorage,
  TranslationState,
  TranslatorId,
} from '../types';
import {
  adoptServedIds,
  getConfig,
  setConfig,
  updateConfig,
  type ResolvedConfig,
  type ResolvedTheme,
} from '../core/config';
import { SignEventEmitter, signError } from '../core/events';
import {
  DEFAULT_MAX_SEGMENT_CHARS,
  indexForOffset,
  normalizeSegment,
  segmentTexts,
  splitByLength,
  splitSentences,
  type SegmentRange,
} from '../core/sentenceSplitter';
import { isSensitive } from '../core/sensitiveDataGuard';
import { resolveSigner, SIGNERS, type Signer } from '../core/signers';
import {
  InMemoryStorage,
  PrefixedStorage,
  readPlaybackPreferences,
  writeLooping,
  writePlaybackSpeed,
} from '../core/storage';
import { TranslationCache } from '../core/translationCache';
import { sendContactRequest, sendFeedback } from '../service/feedbackService';
import {
  translateSegment,
  type TranslateFailure,
} from '../service/signService';

/** Which edge the floating button rests against; the player opens on that side. */
export type DockSide = 'left' | 'right';

export interface ControllerState {
  /** Whether the host has turned the SDK on. */
  enabled: boolean;
  translationState: TranslationState;

  /** The sentences of the tapped paragraph, normalized and ready to send. */
  segments: string[];
  /** Which of them is being translated. */
  segmentIndex: number;
  /** The text of the current segment — the caption. */
  currentText?: string;

  videoUrl?: string;
  cid?: string;
  error?: SignLanguageError;

  /** Whether the user opened the player. See `playerVisible`. */
  openedByUser: boolean;
  collapsed: boolean;

  speed: number;
  looping: boolean;
  isPlaying: boolean;

  /** `undefined` until the user votes on this translation. */
  feedbackVote?: boolean;
  feedbackSending: boolean;
  feedbackAcknowledged: boolean;

  /** Where the floating button rests. Owned here so it survives the player. */
  dockSide: DockSide;
}

const INITIAL_STATE: ControllerState = {
  enabled: false,
  translationState: 'idle',
  segments: [],
  segmentIndex: 0,
  openedByUser: false,
  collapsed: false,
  speed: 1.0,
  looping: true,
  isPlaying: false,
  feedbackSending: false,
  feedbackAcknowledged: false,
  dockSide: 'right',
};

const ERROR_CODES: Record<TranslateFailure['kind'], SignLanguageErrorCode> = {
  cancelled: 'CANCELLED',
  network: 'NETWORK_ERROR',
  api: 'API_ERROR',
};

export class SignController {
  readonly events = new SignEventEmitter();

  private state: ControllerState = INITIAL_STATE;
  private listeners = new Set<() => void>();

  private cache = new TranslationCache();
  private storage: PrefixedStorage = new PrefixedStorage(new InMemoryStorage());

  /**
   * Monotonic request token. Every step of a translation re-checks it and
   * aborts silently when it no longer matches — this is what stops a slow older
   * response from overwriting a newer translation. Rapid taps and fast segment
   * navigation make this routine, not exceptional.
   */
  private token = 0;
  private inFlight?: AbortController;

  /** Preferences are restored once per session. */
  private preferencesRestored = false;

  /** Text already being prefetched, so a second prefetch skips it. */
  private prefetching = new Set<string>();

  /** Whether playback was running when the player was collapsed. */
  private wasPlayingBeforeCollapse = false;

  private disposed = false;

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  getState = (): ControllerState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(patch: Partial<ControllerState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  // -------------------------------------------------------------------------
  // Derived flags — computed, never stored
  // -------------------------------------------------------------------------

  /**
   * The second clause is what makes a purely programmatic `translate(...)`
   * visible in a host that never opened the player.
   */
  get playerVisible(): boolean {
    return this.state.openedByUser || this.state.translationState !== 'idle';
  }

  get playbackAvailable(): boolean {
    return this.state.translationState === 'ready';
  }

  /** The player *is* the mode. There is no invisible tap mode in v2. */
  get tapModeActive(): boolean {
    return this.state.enabled && this.playerVisible && !this.state.collapsed;
  }

  get config(): ResolvedConfig {
    return getConfig();
  }

  /** Which signer the idle loop shows. */
  get signer(): Signer {
    const { tid, fdid } = this.config;
    return resolveSigner({ tid, fdid });
  }

  // -------------------------------------------------------------------------
  // Configuration and lifecycle
  // -------------------------------------------------------------------------

  configure(config: SignLanguageConfig, storage?: SignLanguageStorage): void {
    const resolved = setConfig(config);
    if (storage) this.storage = new PrefixedStorage(storage);

    this.set({
      speed: resolved.card.defaultSpeed,
      looping: resolved.card.defaultLooping,
    });

    // The bar should open correct even before the first translation.
    void this.restorePreferences();
  }

  enable(): void {
    if (this.state.enabled) return;
    this.set({ enabled: true });
  }

  /**
   * Turning the SDK off closes the player and cancels anything in flight, but
   * must not clear stored preferences or the button's resting place —
   * re-enabling restores the user's setup.
   */
  disable(): void {
    if (!this.state.enabled) return;
    this.closeInternal();
    this.set({ enabled: false });
  }

  setLanguage(language: Language): void {
    updateConfig({ language });
  }

  /**
   * Switch translator at runtime, by name — the ids and the idle signer move
   * together, because the loop reads the same pair.
   *
   * Has no effect once the backend has named the translator for this session:
   * the served pair is re-applied over anything set here, by design.
   */
  setTranslator(translator: TranslatorId): void {
    const signer = SIGNERS[translator];
    if (!signer) return;
    updateConfig({ tid: signer.tid, fdid: signer.fdid });
  }

  /**
   * Change theme colours at runtime.
   *
   * There is a runtime setter for every field; this is the one hosts
   * actually reach for, to follow their own light/dark or brand switching.
   */
  setTheme(theme: Partial<ResolvedTheme>): void {
    updateConfig({ theme: { ...getConfig().theme, ...theme } });
  }

  /** Record where the floating button came to rest. */
  setDockSide(side: DockSide): void {
    if (this.state.dockSide === side) return;
    this.set({ dockSide: side });
  }

  // -------------------------------------------------------------------------
  // Player lifecycle
  // -------------------------------------------------------------------------

  /** Open the player, expanded, with tap mode on. */
  openPlayer(): void {
    if (!this.state.enabled) return;
    if (this.state.openedByUser && !this.state.collapsed) return;

    this.set({ openedByUser: true, collapsed: false });
  }

  /**
   * Collapsing is the user saying *get out of the way*: the app goes fully
   * native and playback pauses, because a sign language video nobody can see
   * only spends battery.
   */
  collapse(): void {
    if (this.state.collapsed) return;
    this.wasPlayingBeforeCollapse = this.state.isPlaying;
    this.set({ collapsed: true, isPlaying: false });
    this.events.emit('cardCollapsed', {
      text: this.state.currentText,
      value: true,
    });
  }

  /** Expanding restores tap mode, and playback only if it was playing. */
  expand(): void {
    if (!this.state.collapsed) return;
    this.set({
      collapsed: false,
      isPlaying: this.wasPlayingBeforeCollapse && this.playbackAvailable,
    });
    this.events.emit('cardCollapsed', {
      text: this.state.currentText,
      value: false,
    });
  }

  toggleCollapsed(): void {
    if (this.state.collapsed) this.expand();
    else this.collapse();
  }

  close(): void {
    const wasPlayable = this.playbackAvailable;
    this.closeInternal();
    // panelClose fires only when the player was dismissed while a translation
    // was playable.
    if (wasPlayable) this.events.emit('panelClose', {});
  }

  private closeInternal(): void {
    // Closing while a translation is in flight cancels it; closing otherwise
    // releases the video. Either way segments, translation id and feedback
    // state are cleared.
    this.cancel({ silent: true });

    this.set({
      openedByUser: false,
      collapsed: false,
      translationState: 'idle',
      segments: [],
      segmentIndex: 0,
      currentText: undefined,
      videoUrl: undefined,
      cid: undefined,
      error: undefined,
      isPlaying: false,
      feedbackVote: undefined,
      feedbackSending: false,
      feedbackAcknowledged: false,
    });
    this.wasPlayingBeforeCollapse = false;
  }

  /**
   * The floating button: one tap toggles the mode, opening or closing the
   * player with it.
   */
  toggleTapMode(): void {
    if (!this.state.enabled) return;
    if (this.playerVisible) this.close();
    else this.openPlayer();
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  /**
   * Restored once per session, and never overriding a preference the user has
   * already changed during that session.
   */
  private async restorePreferences(): Promise<void> {
    if (this.preferencesRestored) return;
    this.preferencesRestored = true;

    const { defaultSpeed, defaultLooping } = this.config.card;
    const prefs = await readPlaybackPreferences(this.storage, {
      speed: defaultSpeed,
      looping: defaultLooping,
    });

    if (this.disposed) return;
    this.set({ speed: prefs.speed, looping: prefs.looping });
  }

  // -------------------------------------------------------------------------
  // Translating
  // -------------------------------------------------------------------------

  /**
   * Translate arbitrary text, splitting it per the configured granularity.
   *
   * This is the programmatic entry point, and also where a selection-menu
   * choice lands.
   */
  async translate(text: string): Promise<void> {
    const ranges = this.rangesFor(text);
    const segments = segmentTexts(text, ranges).filter(Boolean);
    if (!segments.length) return;

    await this.translateSegments(segments, 0);
  }

  /**
   * Translate one segment out of a paragraph's worth of them.
   *
   * The full list is kept so the host can step through the paragraph without
   * re-reading the screen.
   */
  async translateSegments(segments: string[], index: number): Promise<void> {
    const cleaned = segments.map(normalizeSegment).filter(Boolean);
    if (!cleaned.length) return;

    const safeIndex = Math.max(0, Math.min(index, cleaned.length - 1));
    this.set({ segments: cleaned, segmentIndex: safeIndex });
    await this.runTranslation(cleaned[safeIndex]!, safeIndex);
  }

  /** Split text the way the configured granularity asks for. */
  rangesFor(text: string): SegmentRange[] {
    const max = this.config.maxSegmentChars || DEFAULT_MAX_SEGMENT_CHARS;
    return this.config.granularity === 'paragraph'
      ? splitByLength(text, max)
      : splitSentences(text, max);
  }

  /** Map a character offset inside `text` to the segment covering it. */
  segmentIndexAtOffset(text: string, offset: number): number {
    return indexForOffset(this.rangesFor(text), offset);
  }

  /** Move to another sentence of the current paragraph. */
  async goToSegment(index: number): Promise<void> {
    const { segments } = this.state;
    if (index < 0 || index >= segments.length) return;
    if (index === this.state.segmentIndex) return;

    this.set({ segmentIndex: index });
    this.events.emit('segmentChanged', { text: segments[index], value: index });
    await this.runTranslation(segments[index]!, index);
  }

  nextSegment(): Promise<void> {
    return this.goToSegment(this.state.segmentIndex + 1);
  }

  previousSegment(): Promise<void> {
    return this.goToSegment(this.state.segmentIndex - 1);
  }

  /**
   * The normative sequence. The numbered steps happen in order.
   */
  private async runTranslation(text: string, index: number): Promise<void> {
    // 1. Take a request token, and drop anything still in flight under the old
    //    one.
    this.inFlight?.abort();
    const token = ++this.token;
    const controller = new AbortController();
    this.inFlight = controller;

    // 2. Reset per-translation state.
    this.set({
      currentText: text,
      segmentIndex: index,
      cid: undefined,
      feedbackVote: undefined,
      feedbackSending: false,
      feedbackAcknowledged: false,
      error: undefined,
    });

    // 3. Restore playback preferences *before* the request, so the control bar
    //    shows the user's stored speed and loop while the translation is still
    //    loading rather than flipping to them afterwards.
    await this.restorePreferences();
    if (token !== this.token) return;

    // 4. Sensitive check. Nothing is sent.
    if (isSensitive(text)) {
      this.set({
        translationState: 'blocked',
        videoUrl: undefined,
        isPlaying: false,
      });
      this.events.emit('blockedSensitive', { text });
      return;
    }

    // 5. Emit textSelected — including on a cache hit.
    this.events.emit('textSelected', { text });

    // 6. Cache lookup. A hit makes no request.
    const cached = this.cache.get(text);
    if (cached) {
      this.set({ translationState: 'loading', cid: cached.cid });
      this.startPrefetch(index);
      this.finishTranslation(token, text, cached.videoUrl, cached.cid);
      return;
    }

    // 7. Go to loading, emit translationStart, send the request.
    this.set({
      translationState: 'loading',
      videoUrl: undefined,
      isPlaying: false,
    });
    this.events.emit('translationStart', { text });

    const outcome = await translateSegment(this.config, text, {
      signal: controller.signal,
    });

    // 8. Handle the response — token check first.
    if (token !== this.token) return;
    this.inFlight = undefined;

    if (!outcome.ok) {
      const { error } = outcome;

      if (error.kind === 'cancelled') {
        this.set({ translationState: 'idle', isPlaying: false });
        this.events.emit('translationError', {
          text,
          error: signError('CANCELLED', 'Translation cancelled'),
        });
        return;
      }

      this.set({
        translationState: 'error',
        isPlaying: false,
        error: signError(ERROR_CODES[error.kind], error.message),
      });
      this.events.emit('translationError', {
        text,
        error: signError(ERROR_CODES[error.kind], error.message),
      });
      return;
    }

    // An override is worth keeping even when the translation itself did not
    // come through, because it decides which signer the loop shows next.
    if (outcome.value.servedTid || outcome.value.servedFdid) {
      adoptServedIds({
        tid: outcome.value.servedTid,
        fdid: outcome.value.servedFdid,
      });
    }

    this.cache.set(text, {
      videoUrl: outcome.value.videoUrl,
      cid: outcome.value.cid,
    });

    // The network round trip is the slow part, so warm the next sentence while
    // this video is still initialising.
    this.startPrefetch(index);

    this.finishTranslation(
      token,
      text,
      outcome.value.videoUrl,
      outcome.value.cid
    );
  }

  /**
   * Step 9: the video becomes playable.
   *
   * `panelOpen`, `videoStart` and `translationComplete` fire together, in that
   * order — hosts use them for panel visibility, playback analytics and
   * translation accounting respectively.
   */
  private finishTranslation(
    token: number,
    text: string,
    videoUrl: string,
    cid?: string
  ): void {
    if (token !== this.token) return;

    this.set({
      translationState: 'ready',
      videoUrl,
      cid,
      isPlaying: true,
      error: undefined,
    });

    this.events.emit('panelOpen', { text });
    this.events.emit('videoStart', { text, videoUrl, cid });
    this.events.emit('translationComplete', { text, videoUrl, cid });
  }

  /**
   * Prefetch exactly one sentence ahead.
   *
   * Silent: it touches neither the state, the request token nor the UI. A
   * prefetch can never change what is on screen, emits nothing, and never
   * adopts backend-served ids.
   */
  private startPrefetch(currentIndex: number): void {
    const next = this.state.segments[currentIndex + 1];
    if (!next) return;
    if (this.cache.has(next) || this.prefetching.has(next)) return;
    // Blocked text never reaches the network, prefetch included.
    if (isSensitive(next)) return;

    this.prefetching.add(next);
    void translateSegment(this.config, next)
      .then((outcome) => {
        if (outcome.ok) {
          this.cache.set(next, {
            videoUrl: outcome.value.videoUrl,
            cid: outcome.value.cid,
          });
        }
      })
      // A failure is ignored — the sentence is simply fetched on demand later.
      .catch(() => {})
      .finally(() => {
        this.prefetching.delete(next);
      });
  }

  /** Cancel an in-flight translation. */
  cancel({ silent = false }: { silent?: boolean } = {}): void {
    if (!this.inFlight) return;
    this.inFlight.abort();
    this.inFlight = undefined;
    // Invalidate the token so a late response cannot land.
    this.token++;

    if (!silent) {
      this.set({ translationState: 'idle', isPlaying: false });
      this.events.emit('translationError', {
        text: this.state.currentText,
        error: signError('CANCELLED', 'Translation cancelled'),
      });
    }
  }

  clearError(): void {
    if (
      this.state.translationState !== 'error' &&
      this.state.translationState !== 'blocked'
    ) {
      return;
    }
    this.set({ translationState: 'idle', error: undefined });
  }

  // -------------------------------------------------------------------------
  // Playback
  // -------------------------------------------------------------------------

  play(): void {
    if (!this.playbackAvailable || this.state.isPlaying) return;
    this.set({ isPlaying: true });
  }

  pause(): void {
    if (!this.state.isPlaying) return;
    this.set({ isPlaying: false });
  }

  togglePlayback(): void {
    if (this.state.isPlaying) this.pause();
    else this.play();
  }

  /**
   * Cycle to the next configured speed.
   *
   * A stored speed no longer in the list is still honoured; the cycle simply
   * restarts from the first entry rather than getting stuck.
   */
  cycleSpeed(): void {
    const { speeds } = this.config.card;
    if (!speeds.length) return;

    const at = speeds.indexOf(this.state.speed);
    const next = speeds[at === -1 ? 0 : (at + 1) % speeds.length]!;
    this.setSpeed(next);
  }

  setSpeed(speed: number): void {
    if (!(speed > 0) || speed === this.state.speed) return;
    this.set({ speed });
    void writePlaybackSpeed(this.storage, speed);
    this.events.emit('playbackSpeedChanged', {
      text: this.state.currentText,
      value: speed,
    });
  }

  toggleLoop(): void {
    const looping = !this.state.looping;
    this.set({ looping });
    void writeLooping(this.storage, looping);
  }

  /** Playback reached the end. Fires once per run, re-arming on restart. */
  reportVideoEnd(): void {
    if (!this.playbackAvailable) return;
    this.events.emit('videoEnd', {
      text: this.state.currentText,
      cid: this.state.cid,
    });
    if (!this.state.looping) this.set({ isPlaying: false });
  }

  /** The video URL could not be initialised or played. */
  reportVideoError(message = 'Video could not be played'): void {
    const error = signError('VIDEO_ERROR', message);
    this.set({ translationState: 'error', isPlaying: false, error });
    this.events.emit('translationError', {
      text: this.state.currentText,
      error,
    });
  }

  // -------------------------------------------------------------------------
  // Feedback and contact
  // -------------------------------------------------------------------------

  /** One vote at a time, recorded optimistically and rolled back on rejection. */
  async vote(positive: boolean): Promise<void> {
    const { cid, currentText, feedbackSending } = this.state;
    if (!cid || !currentText || feedbackSending) return;

    const previous = this.state.feedbackVote;
    this.set({ feedbackVote: positive, feedbackSending: true });

    const accepted = await sendFeedback(this.config, {
      cid,
      text: currentText,
      positive,
    });

    if (accepted) {
      this.set({ feedbackSending: false, feedbackAcknowledged: true });
      this.events.emit('feedbackSent', {
        text: currentText,
        cid,
        value: positive,
      });
    } else {
      this.set({ feedbackVote: previous, feedbackSending: false });
    }
  }

  /** The event fires *before* the call, so the host learns about the intent. */
  async requestContact(): Promise<void> {
    const { cid, currentText } = this.state;
    if (!cid || !currentText) return;

    this.events.emit('contactRequested', { text: currentText, cid });
    await sendContactRequest(this.config, { cid, text: currentText });
  }

  // -------------------------------------------------------------------------
  // Disposal
  // -------------------------------------------------------------------------

  dispose(): void {
    this.cancel({ silent: true });
    this.events.close();
    this.cache.clear();
    this.prefetching.clear();
    this.listeners.clear();
    this.disposed = true;
  }
}
