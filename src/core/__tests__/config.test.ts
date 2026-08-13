import {
  DEFAULT_CONFIG,
  adoptServedIds,
  getConfig,
  hasServedIds,
  languageCode,
  resetConfig,
  resolveConfig,
  setConfig,
  subscribeToConfig,
  updateConfig,
} from '../config';

afterEach(() => {
  resetConfig();
});

describe('resolveConfig', () => {
  it('fills every field from the credentials alone', () => {
    const resolved = resolveConfig({ apiKey: 'K', apiUrl: 'https://api.test' });

    expect(resolved).toMatchObject({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      language: 'tr',
      fdid: '35',
      tid: '43',
      granularity: 'sentence',
      maxSegmentChars: 900,
      longPressToTranslate: false,
      smartPassthrough: true,
    });
    expect(resolved.theme.primaryColor).toBe('#6750A4');
    expect(resolved.theme.textColor).toBe('#1C1B1F');
    expect(resolved.card.speeds).toEqual([1.0, 1.2, 1.5, 2.0]);
  });

  it('makes apiUrl the origin unless originUrl is given', () => {
    expect(
      resolveConfig({ apiKey: 'K', apiUrl: 'https://api.test' }).originUrl
    ).toBe('https://api.test');

    expect(
      resolveConfig({
        apiKey: 'K',
        apiUrl: 'https://api.test',
        originUrl: 'https://app.test',
      }).originUrl
    ).toBe('https://app.test');
  });

  it('leaves unset fields at their default rather than undefined', () => {
    const resolved = resolveConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      theme: { primaryColor: '#000000' },
      card: { showContact: true },
    });

    expect(resolved.theme.primaryColor).toBe('#000000');
    // The rest of the theme is intact.
    expect(resolved.theme.onPrimaryColor).toBe('#FFFFFF');
    expect(resolved.theme.cornerRadius).toBe(16);

    expect(resolved.card.showContact).toBe(true);
    expect(resolved.card.showSpeed).toBe(true);
    expect(resolved.card.avatarMaxWidth).toBe(212);
  });

  it('turns a named translator into the ids it works under', () => {
    const resolved = resolveConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      translator: 'jason',
    });

    expect(resolved).toMatchObject({ tid: '44', fdid: '36' });
  });

  it('lets explicit ids win over the name', () => {
    // The ids are the lower-level control; a host setting both is asking for a
    // pair outside the bundled table.
    const resolved = resolveConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      translator: 'jason',
      fdid: '99',
    });

    // The name still fills in what the host left out.
    expect(resolved).toMatchObject({ tid: '44', fdid: '99' });
  });

  it('ignores an unknown translator rather than failing', () => {
    // A JavaScript host gets no type to check the name against.
    const resolved = resolveConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      translator: 'nobody' as never,
    });

    expect(resolved).toMatchObject({ tid: '43', fdid: '35' });
  });

  it('ignores explicitly undefined values instead of clobbering defaults', () => {
    const resolved = resolveConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      language: undefined,
      theme: { primaryColor: undefined },
    });

    expect(resolved.language).toBe('tr');
    expect(resolved.theme.primaryColor).toBe('#6750A4');
  });

  it('accepts the v1 floatingButton.idleDelay spelling', () => {
    const resolved = resolveConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      floatingButton: { idleDelay: 5000 },
    });

    expect(resolved.floatingButton.idleDelayMs).toBe(5000);
    expect(resolved.floatingButton.hintMaxShows).toBe(2);
  });
});

describe('languageCode', () => {
  it('maps the three supported languages', () => {
    expect(languageCode('tr')).toBe('1');
    expect(languageCode('en')).toBe('2');
    expect(languageCode('ar')).toBe('6');
  });
});

describe('the process-global instance', () => {
  it('starts at the defaults', () => {
    expect(getConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('notifies subscribers when configured', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToConfig(listener);

    setConfig({ apiKey: 'K', apiUrl: 'https://api.test' });
    expect(listener).toHaveBeenCalled();
    expect(getConfig().apiKey).toBe('K');

    unsubscribe();
    listener.mockClear();
    setConfig({ apiKey: 'L', apiUrl: 'https://api.test' });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('adoptServedIds', () => {
  beforeEach(() => {
    setConfig({ apiKey: 'K', apiUrl: 'https://api.test' });
  });

  it('replaces the requested pair with the served one', () => {
    expect(adoptServedIds({ tid: '44', fdid: '36' })).toBe(true);
    expect(getConfig()).toMatchObject({ tid: '44', fdid: '36' });
  });

  it('honours either id on its own', () => {
    // Deliberately not the default pair: adopting a value that already matches
    // is a no-op, which would prove nothing here.
    expect(adoptServedIds({ tid: '44' })).toBe(true);
    expect(getConfig()).toMatchObject({ tid: '44', fdid: '35' });

    expect(adoptServedIds({ fdid: '36' })).toBe(true);
    expect(getConfig()).toMatchObject({ tid: '44', fdid: '36' });
  });

  it.each([
    ['absent', {}],
    ['null', { tid: null, fdid: null }],
    ['empty', { tid: '', fdid: '' }],
    ['whitespace', { tid: '   ' }],
    ['unchanged', { tid: '43', fdid: '35' }],
  ])('changes nothing when the served ids are %s', (_label, ids) => {
    expect(adoptServedIds(ids)).toBe(false);
    expect(getConfig()).toMatchObject({ tid: '43', fdid: '35' });
  });

  it('outranks a later configure() for the rest of the session', () => {
    // The backend is the topmost authority on which translator is in effect:
    // once it has answered under a pair, nothing may take it back.
    adoptServedIds({ tid: '44', fdid: '36' });

    setConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      tid: '23',
      fdid: '16',
    });

    expect(getConfig()).toMatchObject({ tid: '44', fdid: '36' });
  });

  it('outranks a runtime setter too', () => {
    adoptServedIds({ tid: '44', fdid: '36' });

    updateConfig({ tid: '37', fdid: '29', language: 'en' });

    // The language change lands; the translator does not.
    expect(getConfig()).toMatchObject({
      tid: '44',
      fdid: '36',
      language: 'en',
    });
  });

  it('lets a host set the pair while the backend has said nothing', () => {
    expect(hasServedIds()).toBe(false);

    setConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      tid: '23',
      fdid: '16',
    });

    expect(getConfig()).toMatchObject({ tid: '23', fdid: '16' });
  });

  it('keeps serving one id while the host still owns the other', () => {
    adoptServedIds({ tid: '44' });

    setConfig({
      apiKey: 'K',
      apiUrl: 'https://api.test',
      tid: '23',
      fdid: '29',
    });

    expect(getConfig()).toMatchObject({ tid: '44', fdid: '29' });
  });

  it('reports whether the backend has named the translator', () => {
    expect(hasServedIds()).toBe(false);
    adoptServedIds({ tid: '44' });
    expect(hasServedIds()).toBe(true);
  });

  it('notifies the UI so the idle loop can update', () => {
    const listener = jest.fn();
    subscribeToConfig(listener);

    adoptServedIds({ tid: '44' });
    expect(listener).toHaveBeenCalledTimes(1);

    // An adoption that changes nothing must not churn the UI.
    listener.mockClear();
    adoptServedIds({ tid: '44' });
    expect(listener).not.toHaveBeenCalled();
  });
});
