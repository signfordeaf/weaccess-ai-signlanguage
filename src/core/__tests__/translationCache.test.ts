import { CACHE_CAPACITY, TranslationCache } from '../translationCache';

describe('TranslationCache', () => {
  it('returns what it stored', () => {
    const cache = new TranslationCache();
    cache.set('Merhaba', { videoUrl: 'https://v/1.mp4', cid: '7' });

    expect(cache.get('Merhaba')).toEqual({
      videoUrl: 'https://v/1.mp4',
      cid: '7',
    });
    expect(cache.has('Merhaba')).toBe(true);
    expect(cache.get('Başka')).toBeUndefined();
  });

  it('evicts the oldest insertion once full', () => {
    const cache = new TranslationCache(3);
    cache.set('a', { videoUrl: '1' });
    cache.set('b', { videoUrl: '2' });
    cache.set('c', { videoUrl: '3' });
    cache.set('d', { videoUrl: '4' });

    expect(cache.size).toBe(3);
    expect(cache.has('a')).toBe(false);
    expect(cache.keys).toEqual(['b', 'c', 'd']);
  });

  it('moves a re-inserted key to the newest position', () => {
    const cache = new TranslationCache(3);
    cache.set('a', { videoUrl: '1' });
    cache.set('b', { videoUrl: '2' });
    cache.set('c', { videoUrl: '3' });

    cache.set('a', { videoUrl: '1b' });
    cache.set('d', { videoUrl: '4' });

    // 'b' is now the oldest, so 'a' survives with its updated value.
    expect(cache.has('a')).toBe(true);
    expect(cache.get('a')).toEqual({ videoUrl: '1b' });
    expect(cache.has('b')).toBe(false);
    expect(cache.keys).toEqual(['c', 'a', 'd']);
  });

  it('defaults to a 40-entry bound', () => {
    const cache = new TranslationCache();
    for (let i = 0; i < CACHE_CAPACITY + 10; i++) {
      cache.set(`s${i}`, { videoUrl: String(i) });
    }

    expect(cache.size).toBe(CACHE_CAPACITY);
    expect(cache.has('s0')).toBe(false);
    expect(cache.has(`s${CACHE_CAPACITY + 9}`)).toBe(true);
  });

  it('clears', () => {
    const cache = new TranslationCache();
    cache.set('a', { videoUrl: '1' });
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.has('a')).toBe(false);
  });
});
