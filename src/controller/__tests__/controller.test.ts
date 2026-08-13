import { SignController } from '../controller';
import { resetConfig, getConfig } from '../../core/config';
import { sensitiveRegistry } from '../../core/sensitiveDataGuard';
import type { SignEvent } from '../../core/events';

const CONFIG = {
  apiKey: 'RK',
  apiUrl: 'https://api.test',
  language: 'tr' as const,
};

const ready = (extra: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    state: true,
    baseUrl: 'https://cdn.test/v/',
    name: 'a.mp4',
    cid: 'C1',
    st: true,
    ...extra,
  }),
});

let fetchMock: jest.Mock;
let controller: SignController;
let seen: SignEvent[];

/** Types in the order they were emitted. */
const types = () => seen.map((e) => e.type);

const makeController = () => {
  const c = new SignController();
  c.configure(CONFIG);
  c.enable();
  return c;
};

beforeEach(() => {
  fetchMock = jest.fn().mockImplementation(() => Promise.resolve(ready()));
  (globalThis as any).fetch = fetchMock;

  controller = makeController();
  seen = [];
  controller.events.onAny((event) => seen.push(event));
});

afterEach(() => {
  controller.dispose();
  sensitiveRegistry.clear();
  resetConfig();
});

describe('lifecycle', () => {
  it('starts disabled, with the player closed', () => {
    const fresh = new SignController();
    expect(fresh.getState().enabled).toBe(false);
    expect(fresh.playerVisible).toBe(false);
    expect(fresh.tapModeActive).toBe(false);
    fresh.dispose();
  });

  it('opens the player expanded, with tap mode on', () => {
    controller.openPlayer();

    expect(controller.playerVisible).toBe(true);
    expect(controller.getState().collapsed).toBe(false);
    expect(controller.tapModeActive).toBe(true);
  });

  it('turns tap mode off and pauses playback when collapsed', async () => {
    controller.openPlayer();
    await controller.translate('Bir cümle burada.');
    expect(controller.getState().isPlaying).toBe(true);

    controller.collapse();

    expect(controller.tapModeActive).toBe(false);
    expect(controller.getState().isPlaying).toBe(false);
    expect(
      seen.some((e) => e.type === 'cardCollapsed' && e.value === true)
    ).toBe(true);
  });

  it('restores both on expand, resuming only if it was playing', async () => {
    controller.openPlayer();
    await controller.translate('Bir cümle burada.');

    controller.collapse();
    controller.expand();
    expect(controller.getState().isPlaying).toBe(true);
    expect(controller.tapModeActive).toBe(true);

    // Paused before collapsing: it must stay paused.
    controller.pause();
    controller.collapse();
    controller.expand();
    expect(controller.getState().isPlaying).toBe(false);
  });

  it('clears everything on close', async () => {
    controller.openPlayer();
    await controller.translate('Bir cümle burada.');

    controller.close();

    const state = controller.getState();
    expect(controller.playerVisible).toBe(false);
    expect(state.segments).toEqual([]);
    expect(state.cid).toBeUndefined();
    expect(state.videoUrl).toBeUndefined();
    expect(state.feedbackVote).toBeUndefined();
    expect(state.translationState).toBe('idle');
  });

  it('emits panelClose only when a translation was playable', async () => {
    controller.openPlayer();
    controller.close();
    expect(types()).not.toContain('panelClose');

    controller.openPlayer();
    await controller.translate('Bir cümle burada.');
    seen = [];
    controller.close();
    expect(types()).toContain('panelClose');
  });

  it('closes the player when the SDK is disabled', async () => {
    controller.openPlayer();
    await controller.translate('Bir cümle burada.');

    controller.disable();

    expect(controller.playerVisible).toBe(false);
    expect(controller.tapModeActive).toBe(false);
    expect(controller.getState().enabled).toBe(false);
  });

  it('keeps preferences and the dock side across a disable/enable cycle', () => {
    controller.setSpeed(1.5);
    controller.setDockSide('left');

    controller.disable();
    controller.enable();

    expect(controller.getState().speed).toBe(1.5);
    expect(controller.getState().dockSide).toBe('left');
  });

  it('makes a purely programmatic translation visible', async () => {
    // The host never opened the player.
    expect(controller.playerVisible).toBe(false);
    await controller.translate('Bir cümle burada.');
    expect(controller.playerVisible).toBe(true);
  });
});

describe('translation flow', () => {
  it('emits the terminal events in order', async () => {
    await controller.translate('Bir cümle burada.');

    expect(types()).toEqual([
      'textSelected',
      'translationStart',
      'panelOpen',
      'videoStart',
      'translationComplete',
    ]);
  });

  it('assembles the video URL and goes to ready', async () => {
    await controller.translate('Bir cümle burada.');

    const state = controller.getState();
    expect(state.translationState).toBe('ready');
    expect(state.videoUrl).toBe('https://cdn.test/v/a.mp4');
    expect(state.cid).toBe('C1');
    expect(controller.playbackAvailable).toBe(true);
  });

  it('does nothing for empty text', async () => {
    await controller.translate('   ');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(types()).toEqual([]);
  });

  it('splits a paragraph and selects the tapped sentence', async () => {
    const text = 'Birinci cümle. İkinci cümle. Üçüncü cümle.';
    const segments = ['Birinci cümle.', 'İkinci cümle.', 'Üçüncü cümle.'];

    await controller.translateSegments(segments, 1);

    expect(controller.getState().segmentIndex).toBe(1);
    expect(controller.getState().currentText).toBe('İkinci cümle.');
    expect(controller.getState().segments).toEqual(segments);
    expect(text).toContain('İkinci');
  });

  it('does not hit the API twice for the same sentence', async () => {
    await controller.translate('Bir cümle burada.');
    const first = fetchMock.mock.calls.length;

    seen = [];
    await controller.translate('Bir cümle burada.');

    expect(fetchMock.mock.calls.length).toBe(first);
    // textSelected still fires on a cache hit; translationStart does not.
    expect(types()).toContain('textSelected');
    expect(types()).not.toContain('translationStart');
    expect(types()).toContain('translationComplete');
  });

  it('prefetches the next sentence as soon as the current one resolves', async () => {
    await controller.translateSegments(['Birinci cümle.', 'İkinci cümle.'], 0);
    await Promise.resolve();
    await Promise.resolve();

    const sent = fetchMock.mock.calls.map(([url]) => decodeURIComponent(url));
    expect(
      sent.some(
        (u) =>
          u.includes('s=İkinci+cümle.'.replace('+', ' ')) ||
          u.includes('İkinci')
      )
    ).toBe(true);
  });

  it('emits nothing for a prefetch', async () => {
    await controller.translateSegments(['Birinci cümle.', 'İkinci cümle.'], 0);
    await Promise.resolve();
    await Promise.resolve();

    // Exactly one translation's worth of events, not two.
    expect(types().filter((t) => t === 'translationComplete')).toHaveLength(1);
  });

  it('does not prefetch on the last sentence', async () => {
    await controller.translateSegments(['Tek cümle burada.'], 0);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('moves the ids and the idle signer together on setTranslator', async () => {
    controller.setTranslator('owais');

    expect(getConfig()).toMatchObject({ tid: '37', fdid: '29' });
    expect(controller.signer.id).toBe('owais');

    await controller.translate('Bir cümle burada.');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('tid')).toBe('37');
  });

  it('lets the served pair outrank setTranslator', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(ready({ tid: 44, fdid: '36' }))
    );
    await controller.translate('Bir cümle burada.');

    controller.setTranslator('owais');

    expect(getConfig()).toMatchObject({ tid: '44', fdid: '36' });
    expect(controller.signer.id).toBe('jason');
  });

  it('adopts the ids a response came back under', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(ready({ tid: 44, fdid: '36' }))
    );

    await controller.translate('Bir cümle burada.');

    expect(getConfig()).toMatchObject({ tid: '44', fdid: '36' });
    expect(controller.signer.id).toBe('jason');
  });

  it('keeps the served translator for the rest of the session', async () => {
    // The backend is the final authority: once it has answered under a pair,
    // the idle loop shows that signer and every later request uses it — even
    // if the host reconfigures in between.
    fetchMock.mockImplementation(() =>
      Promise.resolve(ready({ tid: 44, fdid: '36' }))
    );
    await controller.translate('Bir cümle burada.');
    expect(controller.signer.id).toBe('jason');

    // The host reconfigures, asking for Kadir.
    controller.configure({ ...CONFIG, tid: '23', fdid: '16' });

    expect(getConfig()).toMatchObject({ tid: '44', fdid: '36' });
    expect(controller.signer.id).toBe('jason');

    // And the next request still goes out under the served pair.
    fetchMock.mockClear();
    fetchMock.mockImplementation(() => Promise.resolve(ready()));
    await controller.translate('Başka bir cümle.');

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('tid')).toBe('44');
    expect(url.searchParams.get('fdid')).toBe('36');
  });

  it('leaves the configured pair alone when a response states none', async () => {
    await controller.translate('Bir cümle burada.');
    expect(getConfig()).toMatchObject({ tid: '43', fdid: '35' });
    expect(controller.signer.id).toBe('hesna');
  });

  it('goes to error when the response carries no video', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ state: true, baseUrl: null, name: null }),
      })
    );

    await controller.translate('Bir cümle burada.');

    expect(controller.getState().translationState).toBe('error');
    expect(controller.getState().error?.code).toBe('API_ERROR');
    expect(types()).toContain('translationError');
    expect(types()).not.toContain('translationComplete');
  });

  it('emits exactly one terminal event per translation', async () => {
    await controller.translate('Bir cümle burada.');

    const terminal = types().filter((t) =>
      ['translationComplete', 'translationError', 'blockedSensitive'].includes(
        t
      )
    );
    expect(terminal).toHaveLength(1);
  });
});

describe('sensitive data', () => {
  it('blocks the translation and makes no request', async () => {
    await controller.translate('Kart: 4242 4242 4242 4242');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(controller.getState().translationState).toBe('blocked');
    expect(types()).toEqual(['blockedSensitive']);
  });

  it('blocks only the sentence containing it', async () => {
    const segments = [
      'Merhaba dünya.',
      'IBAN TR33 0006 1005 1978 6457 8413 26',
    ];

    await controller.translateSegments(segments, 0);
    expect(controller.getState().translationState).toBe('ready');

    await controller.goToSegment(1);
    expect(controller.getState().translationState).toBe('blocked');
  });

  it('skips sensitive text when prefetching', async () => {
    await controller.translateSegments(
      ['Merhaba dünya.', 'Kart 4242 4242 4242 4242'],
      0
    );
    await Promise.resolve();
    await Promise.resolve();

    // Only the foreground sentence went out.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('superseding and cancellation', () => {
  it('lets a newer translation win over a slow older one', async () => {
    let resolveFirst: (value: unknown) => void = () => {};

    // Keyed by URL, not by call order: the request-token check means a
    // superseded translation can return before it ever reaches fetch.
    fetchMock.mockImplementation((url: string) =>
      decodeURIComponent(url).includes('Birinci')
        ? new Promise((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve(ready({ name: 'second.mp4' }))
    );

    const first = controller.translate('Birinci cümle burada.');
    // Let the first translation actually get its request out.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const second = controller.translate('İkinci cümle burada.');
    await second;

    // The slow one lands afterwards and must change nothing.
    resolveFirst(ready({ name: 'first.mp4' }));
    await first;

    expect(controller.getState().videoUrl).toBe(
      'https://cdn.test/v/second.mp4'
    );
    expect(controller.getState().currentText).toBe('İkinci cümle burada.');
  });

  it('emits nothing further for a superseded translation', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      decodeURIComponent(url).includes('Birinci')
        ? new Promise((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve(ready({ name: 'second.mp4' }))
    );

    const first = controller.translate('Birinci cümle burada.');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await controller.translate('İkinci cümle burada.');
    seen = [];

    resolveFirst(ready({ name: 'first.mp4' }));
    await first;

    // The token check aborts it silently.
    expect(types()).toEqual([]);
  });

  it('cancels an in-flight request when the player closes', async () => {
    let settle: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((resolve, reject) => {
          settle = resolve;
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })
    );

    controller.openPlayer();
    const pending = controller.translate('Bir cümle burada.');

    controller.close();
    settle(ready());
    await pending;

    expect(controller.getState().translationState).toBe('idle');
    expect(controller.getState().videoUrl).toBeUndefined();
  });
});

describe('playback controls', () => {
  it('cycles through the configured speeds', () => {
    expect(controller.getState().speed).toBe(1.0);

    controller.cycleSpeed();
    expect(controller.getState().speed).toBe(1.2);
    controller.cycleSpeed();
    expect(controller.getState().speed).toBe(1.5);
    controller.cycleSpeed();
    expect(controller.getState().speed).toBe(2.0);
    controller.cycleSpeed();
    expect(controller.getState().speed).toBe(1.0);
  });

  it('restarts the cycle from a speed no longer in the list', () => {
    controller.setSpeed(3.0);
    controller.cycleSpeed();
    expect(controller.getState().speed).toBe(1.0);
  });

  it('emits playbackSpeedChanged', () => {
    controller.setSpeed(1.5);
    expect(
      seen.some((e) => e.type === 'playbackSpeedChanged' && e.value === 1.5)
    ).toBe(true);
  });

  it('toggles loop', () => {
    expect(controller.getState().looping).toBe(true);
    controller.toggleLoop();
    expect(controller.getState().looping).toBe(false);
  });

  it('keeps speed and loop usable before a video is ready', () => {
    // Play is unavailable until ready; speed and loop are not.
    expect(controller.playbackAvailable).toBe(false);
    controller.play();
    expect(controller.getState().isPlaying).toBe(false);

    controller.cycleSpeed();
    controller.toggleLoop();
    expect(controller.getState().speed).toBe(1.2);
    expect(controller.getState().looping).toBe(false);
  });

  it('fires videoEnd once per run', async () => {
    await controller.translate('Bir cümle burada.');
    seen = [];

    controller.reportVideoEnd();
    expect(types().filter((t) => t === 'videoEnd')).toHaveLength(1);
  });

  it('reports a video failure as an error state', async () => {
    await controller.translate('Bir cümle burada.');
    seen = [];

    controller.reportVideoError();

    expect(controller.getState().translationState).toBe('error');
    expect(controller.getState().error?.code).toBe('VIDEO_ERROR');
    expect(types()).toContain('translationError');
  });
});

describe('segment navigation', () => {
  it('emits segmentChanged and translates the new sentence', async () => {
    await controller.translateSegments(['Birinci cümle.', 'İkinci cümle.'], 0);
    seen = [];

    await controller.goToSegment(1);

    expect(seen.some((e) => e.type === 'segmentChanged' && e.value === 1)).toBe(
      true
    );
    expect(controller.getState().currentText).toBe('İkinci cümle.');
  });

  it('ignores an out-of-range index', async () => {
    await controller.translateSegments(['Birinci cümle.'], 0);
    seen = [];

    await controller.goToSegment(5);
    await controller.goToSegment(-1);

    expect(types()).toEqual([]);
  });
});

describe('segment mapping', () => {
  it('maps a character offset to the sentence containing it', () => {
    const text = 'Birinci cümle. İkinci cümle. Üçüncü cümle.';

    expect(controller.segmentIndexAtOffset(text, 0)).toBe(0);
    expect(controller.segmentIndexAtOffset(text, 20)).toBe(1);
    expect(controller.segmentIndexAtOffset(text, text.length)).toBe(2);
    expect(controller.segmentIndexAtOffset(text, -1)).toBe(-1);
  });

  it('reports one segment in paragraph granularity', () => {
    controller.configure({ ...CONFIG, granularity: 'paragraph' });
    const text = 'Birinci cümle. İkinci cümle.';

    expect(controller.rangesFor(text)).toHaveLength(1);
  });
});
