import {
  ALL_SIGNERS,
  FALLBACK_SIGNER,
  parseServedId,
  resolveSigner,
  SIGNERS,
} from '../signers';
import { DEFAULT_CONFIG } from '../config';

describe('the signer table', () => {
  it('gives every signer a unique id pair and a real asset', () => {
    const pairs = ALL_SIGNERS.map((s) => `${s.tid}/${s.fdid}`);
    expect(new Set(pairs).size).toBe(ALL_SIGNERS.length);

    for (const signer of ALL_SIGNERS) {
      expect(signer.asset).toMatch(/^placeholder-\w+\.mp4$/);
      expect(signer.tid).not.toBe('');
      expect(signer.fdid).not.toBe('');
    }
  });

  it('resolves the SDK defaults to the signer behind them', () => {
    // tid 43 / fdid 35 is Hesna. The default pair is deliberately the same
    // signer the ladder falls back to, so an integration that sets nothing can
    // never see the idle loop and the translation disagree.
    expect(
      resolveSigner({ tid: DEFAULT_CONFIG.tid, fdid: DEFAULT_CONFIG.fdid }).id
    ).toBe('hesna');
  });
});

describe('resolveSigner', () => {
  it('matches an exact pair', () => {
    expect(resolveSigner({ tid: '44', fdid: '36' }).id).toBe('jason');
    expect(resolveSigner({ tid: '37', fdid: '29' }).id).toBe('owais');
  });

  it('resolves from either id alone', () => {
    expect(resolveSigner({ tid: '43' }).id).toBe('hesna');
    expect(resolveSigner({ fdid: '29' }).id).toBe('owais');
  });

  it('lets tid win when the two disagree', () => {
    // tid *is* the translator; fdid only selects the vocabulary they sign
    // from, and the person on screen is the translator either way.
    expect(resolveSigner({ tid: '44', fdid: '16' }).id).toBe('jason');
  });

  it('falls back to the stand-in rather than a bare spinner', () => {
    expect(resolveSigner({ tid: '999', fdid: '999' })).toBe(FALLBACK_SIGNER);
    expect(resolveSigner({})).toBe(FALLBACK_SIGNER);
  });

  it.each([
    ['empty strings', { tid: '', fdid: '' }],
    ['whitespace', { tid: '  ', fdid: '\t' }],
    ['nulls', { tid: null, fdid: null }],
  ])('treats %s as absent', (_label, ids) => {
    expect(resolveSigner(ids)).toBe(FALLBACK_SIGNER);
  });

  it('resolves a partially matching pair by its tid', () => {
    // fdid 16 is Kadir's, but tid 43 is Hesna, and tid wins.
    expect(resolveSigner({ tid: '43', fdid: '16' })).toBe(SIGNERS.hesna);
  });
});

describe('parseServedId', () => {
  it('parses ids whether the API quotes them or not', () => {
    expect(parseServedId('44')).toBe('44');
    expect(parseServedId(44)).toBe('44');
  });

  it.each([null, undefined, '', '   ', {}, [], NaN])(
    'reads %p as absent',
    (value) => {
      expect(parseServedId(value)).toBeNull();
    }
  );
});
