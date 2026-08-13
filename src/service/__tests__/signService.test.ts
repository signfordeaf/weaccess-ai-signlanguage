import { resolveConfig } from '../../core/config';
import {
  abortError,
  buildTranslateUrl,
  buildVideoUrl,
  translateSegment,
} from '../signService';

const CONFIG = resolveConfig({
  apiKey: 'RK123',
  apiUrl: 'https://api.test',
  language: 'tr',
});

/** A successful backend response. */
const ready = (extra: Record<string, unknown> = {}) => ({
  state: true,
  baseUrl: 'https://cdn.test/videos/',
  name: 'abc.mp4',
  cid: 'C1',
  st: true,
  ...extra,
});

/** A response that means "still rendering". */
const rendering = () => ({
  state: false,
  baseUrl: null,
  name: null,
  cid: null,
  st: null,
});

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  (globalThis as any).fetch = fetchMock;
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Run pending timers until the promise settles, so polling does not hang. */
const settle = async <T>(promise: Promise<T>): Promise<T> => {
  let done = false;
  const wrapped = promise.then((value) => {
    done = true;
    return value;
  });
  while (!done) {
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  }
  return wrapped;
};

describe('buildVideoUrl', () => {
  it('concatenates without inserting a separator', () => {
    expect(buildVideoUrl('https://cdn.test/videos/', 'abc.mp4')).toBe(
      'https://cdn.test/videos/abc.mp4'
    );
  });

  it('rewrites only the first http: and only the scheme', () => {
    expect(buildVideoUrl('http://cdn.test/v/', 'a.mp4')).toBe(
      'https://cdn.test/v/a.mp4'
    );
    // A later occurrence inside a query string is left alone.
    expect(buildVideoUrl('http://cdn.test/v/', 'a.mp4?u=http://x')).toBe(
      'https://cdn.test/v/a.mp4?u=http://x'
    );
  });
});

describe('buildTranslateUrl', () => {
  it('sends every documented parameter', () => {
    const url = new URL(buildTranslateUrl(CONFIG, 'Merhaba dünya'));

    expect(url.pathname).toBe('/Translate');
    expect(url.searchParams.get('s')).toBe('Merhaba dünya');
    expect(url.searchParams.get('rk')).toBe('RK123');
    expect(url.searchParams.get('fdid')).toBe('35');
    expect(url.searchParams.get('tid')).toBe('43');
    expect(url.searchParams.get('language')).toBe('1');
    expect(url.searchParams.get('url')).toBe('https://api.test');
  });

  it('maps the three supported languages to their codes', () => {
    const codeFor = (language: 'tr' | 'en' | 'ar') =>
      new URL(
        buildTranslateUrl(
          resolveConfig({ apiKey: 'K', apiUrl: 'https://api.test', language }),
          'x'
        )
      ).searchParams.get('language');

    expect(codeFor('tr')).toBe('1');
    expect(codeFor('en')).toBe('2');
    expect(codeFor('ar')).toBe('6');
  });

  it('uses originUrl for the url parameter when one is given', () => {
    const config = resolveConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      originUrl: 'https://app.test',
    });

    expect(
      new URL(buildTranslateUrl(config, 'x')).searchParams.get('url')
    ).toBe('https://app.test');
  });
});

describe('translateSegment', () => {
  it('returns the assembled video URL and the translation id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(ready()));

    const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

    expect(outcome).toEqual({
      ok: true,
      value: { videoUrl: 'https://cdn.test/videos/abc.mp4', cid: 'C1' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the origin as a header as well as a parameter', async () => {
    fetchMock.mockResolvedValue(jsonResponse(ready()));
    await settle(translateSegment(CONFIG, 'Merhaba'));

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      Origin: 'https://api.test',
    });
  });

  it('repeats the same request while the video is still rendering', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(rendering()))
      .mockResolvedValueOnce(jsonResponse(rendering()))
      .mockResolvedValue(jsonResponse(ready()));

    const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

    expect(outcome.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The same request, not a different one.
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[2][0]);
  });

  it('gives up after 30 attempts and reports an api error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(rendering()));

    const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

    expect(fetchMock).toHaveBeenCalledTimes(30);
    expect(outcome).toMatchObject({ ok: false, error: { kind: 'api' } });
  });

  it('reads served ids whether the API quotes them or not', async () => {
    fetchMock.mockResolvedValue(jsonResponse(ready({ tid: 44, fdid: '36' })));

    const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

    expect(outcome).toMatchObject({
      ok: true,
      value: { servedTid: '44', servedFdid: '36' },
    });
  });

  it('omits served ids when the response states none', async () => {
    fetchMock.mockResolvedValue(jsonResponse(ready()));

    const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

    expect(outcome).toMatchObject({ ok: true });
    if (outcome.ok) {
      expect(outcome.value.servedTid).toBeUndefined();
      expect(outcome.value.servedFdid).toBeUndefined();
    }
  });

  it.each([
    ['baseUrl', ready({ baseUrl: null })],
    ['name', ready({ name: null })],
  ])('fails with an api error when %s is missing', async (_label, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body));

    const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

    expect(outcome).toMatchObject({ ok: false, error: { kind: 'api' } });
  });

  it.each([400, 401, 403, 404, 500, 418])(
    'maps HTTP %i to an api error carrying the status',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(null, false, status));

      const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

      expect(outcome).toMatchObject({
        ok: false,
        error: { kind: 'api', status },
      });
    }
  );

  it('maps a transport failure to a network error', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    const outcome = await settle(translateSegment(CONFIG, 'Merhaba'));

    expect(outcome).toMatchObject({
      ok: false,
      error: { kind: 'network', message: 'offline' },
    });
  });

  it('reports cancellation distinctly from failure', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(() => {
      controller.abort();
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    const outcome = await settle(
      translateSegment(CONFIG, 'Merhaba', { signal: controller.signal })
    );

    expect(outcome).toEqual({ ok: false, error: { kind: 'cancelled' } });
  });

  it('does not make a request at all when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const outcome = await settle(
      translateSegment(CONFIG, 'Merhaba', { signal: controller.signal })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome).toEqual({ ok: false, error: { kind: 'cancelled' } });
  });

  it('stops polling when cancelled between attempts', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(jsonResponse(rendering()));

    const promise = translateSegment(CONFIG, 'Merhaba', {
      signal: controller.signal,
    });

    // Let the first request resolve, then cancel during the retry delay.
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    const outcome = await settle(promise);

    expect(outcome).toEqual({ ok: false, error: { kind: 'cancelled' } });
    expect(fetchMock.mock.calls.length).toBeLessThan(30);
  });
});

/**
 * The retry delay used to reject with a `DOMException`. Node defines that as a
 * global and Hermes does not, so on a device the abort threw a `ReferenceError`
 * out of the listener: the wait never settled and the translation hung forever,
 * while every test above stayed green.
 *
 * The global cannot simply be deleted for an end-to-end test — Node's own
 * `AbortController` builds a `DOMException` for `signal.reason` — so the
 * constructor is exercised directly instead. That is the only line that ever
 * touched the global.
 */
describe('abortError', () => {
  it('is built without any global the SDK cannot rely on', () => {
    const original = (globalThis as { DOMException?: unknown }).DOMException;
    delete (globalThis as { DOMException?: unknown }).DOMException;

    try {
      const error = abortError();
      // `isAbort` matches on the name, so that is the part that must survive.
      expect(error.name).toBe('AbortError');
      expect(error).toBeInstanceOf(Error);
    } finally {
      (globalThis as { DOMException?: unknown }).DOMException = original;
    }
  });
});
