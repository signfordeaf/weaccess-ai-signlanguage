import {
  InMemoryStorage,
  PrefixedStorage,
  STORAGE_PREFIX,
  readPlaybackPreferences,
  writeLooping,
  writePlaybackSpeed,
} from '../storage';

const DEFAULTS = { speed: 1.0, looping: true };

describe('PrefixedStorage', () => {
  it('prefixes every key so the SDK cannot collide with the host', async () => {
    const backing = new InMemoryStorage();
    const storage = new PrefixedStorage(backing);

    await storage.set('looping', 'false');

    expect(await backing.getItem(`${STORAGE_PREFIX}looping`)).toBe('false');
    expect(await backing.getItem('looping')).toBeNull();
  });

  it('swallows a failing store rather than disturbing playback', async () => {
    const broken = {
      getItem: jest.fn().mockRejectedValue(new Error('disk on fire')),
      setItem: jest.fn().mockRejectedValue(new Error('disk on fire')),
    };
    const storage = new PrefixedStorage(broken);

    await expect(storage.get('looping')).resolves.toBeNull();
    await expect(storage.set('looping', 'true')).resolves.toBeUndefined();
  });
});

describe('readPlaybackPreferences', () => {
  const storageWith = (entries: Record<string, string>) => {
    const backing = new InMemoryStorage();
    const storage = new PrefixedStorage(backing);
    return Promise.all(
      Object.entries(entries).map(([k, v]) => storage.set(k, v))
    ).then(() => storage);
  };

  it('falls back to the configured defaults when nothing is stored', async () => {
    const storage = new PrefixedStorage(new InMemoryStorage());
    await expect(readPlaybackPreferences(storage, DEFAULTS)).resolves.toEqual(
      DEFAULTS
    );
  });

  it('restores what the user set', async () => {
    const storage = await storageWith({
      playback_speed: '1.5',
      looping: 'false',
    });

    await expect(readPlaybackPreferences(storage, DEFAULTS)).resolves.toEqual({
      speed: 1.5,
      looping: false,
    });
  });

  it.each(['0', '-1', 'fast', ''])(
    'rejects a non-positive or unparsable speed (%p)',
    async (stored) => {
      const storage = await storageWith({ playback_speed: stored });
      const prefs = await readPlaybackPreferences(storage, DEFAULTS);
      expect(prefs.speed).toBe(DEFAULTS.speed);
    }
  );

  it('honours a stored speed no longer in the configured list', async () => {
    // The speed button restarts its cycle rather than getting stuck.
    const storage = await storageWith({ playback_speed: '3.0' });
    const prefs = await readPlaybackPreferences(storage, DEFAULTS);
    expect(prefs.speed).toBe(3.0);
  });

  it.each(['yes', 'TRUE', ''])(
    'falls back for an unparsable looping value (%p)',
    async (stored) => {
      const storage = await storageWith({ looping: stored });
      const prefs = await readPlaybackPreferences(storage, DEFAULTS);
      expect(prefs.looping).toBe(DEFAULTS.looping);
    }
  );

  it('round-trips through the writers', async () => {
    const storage = new PrefixedStorage(new InMemoryStorage());

    await writePlaybackSpeed(storage, 1.2);
    await writeLooping(storage, false);

    await expect(readPlaybackPreferences(storage, DEFAULTS)).resolves.toEqual({
      speed: 1.2,
      looping: false,
    });
  });
});
