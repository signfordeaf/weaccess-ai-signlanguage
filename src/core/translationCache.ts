/**
 * The translation cache.
 *
 * Keyed by the exact segment text — which is why normalization matters: the
 * same sentence must always produce the same request string, because that
 * string is this key.
 *
 * A cache hit must not re-request. Stepping back and forth through the
 * sentences of a paragraph, or tapping the same text twice, is free.
 *
 * The cache does not survive an app launch: URLs are backend-scoped and
 * short-lived, and a stale cached URL is worse than a re-fetch.
 */

export interface CachedTranslation {
  videoUrl: string;
  /** Translation id, tying feedback and contact back to this translation. */
  cid?: string;
}

export const CACHE_CAPACITY = 40;

/**
 * Bounded, evicting the oldest *insertion* first. Re-inserting an existing key
 * moves it to the newest position.
 *
 * A `Map` preserves insertion order, so the oldest key is simply the first one
 * the iterator yields.
 */
export class TranslationCache {
  private entries = new Map<string, CachedTranslation>();

  constructor(private readonly capacity: number = CACHE_CAPACITY) {}

  get(text: string): CachedTranslation | undefined {
    return this.entries.get(text);
  }

  has(text: string): boolean {
    return this.entries.has(text);
  }

  set(text: string, value: CachedTranslation): void {
    // Delete first so a re-insert moves to the newest position rather than
    // updating in place at its original spot.
    this.entries.delete(text);
    this.entries.set(text, value);

    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  /** Oldest first. Exported for tests. */
  get keys(): string[] {
    return [...this.entries.keys()];
  }
}
