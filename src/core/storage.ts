/**
 * Persistence.
 *
 * The SDK stores very little, and what it stores is deliberate: preferences
 * the user set by hand, and a counter that stops an onboarding hint repeating
 * forever. Nothing about the user's content — no text, no translation URL, no
 * translation id — is ever written to disk.
 */

import type { SignLanguageStorage } from '../types';

/**
 * Prepended to every key, so the SDK cannot collide with the host app's own
 * preferences. Ports must keep this prefix so a device migrating between SDK
 * versions keeps its settings.
 */
export const STORAGE_PREFIX = 'weaccess_sl_';

/** The complete list of what is stored. */
export const STORAGE_KEYS = {
  playbackSpeed: 'playback_speed',
  looping: 'looping',
} as const;

/**
 * The default store: in memory, for the current session only.
 *
 * Tests that pin down preference behavior need a store with no platform
 * underneath them, and an integration that supplies nothing still gets working
 * (if forgetful) preferences rather than a crash.
 */
export class InMemoryStorage implements SignLanguageStorage {
  private map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
}

/**
 * Wraps a host-supplied store, applying the key prefix and swallowing every
 * failure.
 *
 * A preference that cannot be read is not an error worth surfacing: the
 * configured default stands in, and the player opens correctly anyway.
 */
export class PrefixedStorage {
  constructor(private readonly backing: SignLanguageStorage) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.backing.getItem(STORAGE_PREFIX + key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.backing.setItem(STORAGE_PREFIX + key, value);
    } catch {
      // Losing a preference is not worth disturbing playback.
    }
  }
}

export interface PlaybackPreferences {
  speed: number;
  looping: boolean;
}

/**
 * Read the stored playback preferences, falling back to the configured
 * defaults.
 *
 * A stored speed must be positive to be accepted. One that is no longer in the
 * configured `speeds` list is still honoured — the speed button simply
 * restarts its cycle from the first entry rather than getting stuck.
 */
export const readPlaybackPreferences = async (
  storage: PrefixedStorage,
  defaults: PlaybackPreferences
): Promise<PlaybackPreferences> => {
  const [rawSpeed, rawLooping] = await Promise.all([
    storage.get(STORAGE_KEYS.playbackSpeed),
    storage.get(STORAGE_KEYS.looping),
  ]);

  const parsedSpeed = rawSpeed == null ? NaN : Number.parseFloat(rawSpeed);
  const speed =
    Number.isFinite(parsedSpeed) && parsedSpeed > 0
      ? parsedSpeed
      : defaults.speed;

  const looping =
    rawLooping === 'true'
      ? true
      : rawLooping === 'false'
      ? false
      : defaults.looping;

  return { speed, looping };
};

export const writePlaybackSpeed = (
  storage: PrefixedStorage,
  speed: number
): Promise<void> => storage.set(STORAGE_KEYS.playbackSpeed, String(speed));

export const writeLooping = (
  storage: PrefixedStorage,
  looping: boolean
): Promise<void> => storage.set(STORAGE_KEYS.looping, String(looping));
