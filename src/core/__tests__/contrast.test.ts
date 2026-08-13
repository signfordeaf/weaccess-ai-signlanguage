import {
  BLACK,
  WHITE,
  clearContrastCache,
  contrastRatio,
  parseColor,
  relativeLuminance,
  resolveForeground,
} from '../contrast';

beforeEach(() => {
  clearContrastCache();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('parseColor', () => {
  it.each([
    ['#FFFFFF', { r: 255, g: 255, b: 255 }],
    ['#000', { r: 0, g: 0, b: 0 }],
    ['#6750A4', { r: 0x67, g: 0x50, b: 0xa4 }],
    ['6750A4', { r: 0x67, g: 0x50, b: 0xa4 }],
    ['  #fff  ', { r: 255, g: 255, b: 255 }],
    ['rgb(255, 0, 0)', { r: 255, g: 0, b: 0 }],
    ['rgba(0, 128, 255, 0.5)', { r: 0, g: 128, b: 255 }],
  ])('parses %s', (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it('ignores the alpha channel of an 8-digit hex', () => {
    expect(parseColor('#6750A480')).toEqual(parseColor('#6750A4'));
  });

  it.each(['', 'not a color', '#12345', 'rgb(1,2)', null, undefined, 42])(
    'returns null for %p',
    (input) => {
      expect(parseColor(input as any)).toBeNull();
    }
  );
});

describe('relativeLuminance', () => {
  it('runs from 0 for black to 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('makes black on white the maximum', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
  });

  it('makes a color against itself the minimum', () => {
    expect(contrastRatio('#6750A4', '#6750A4')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#6750A4', WHITE)).toBeCloseTo(
      contrastRatio(WHITE, '#6750A4'),
      10
    );
  });

  it('reports the worst possible ratio for an unparseable color', () => {
    // Unmeasurable must read as "substitute", never as "this is fine".
    expect(contrastRatio('chartreuse-ish', WHITE)).toBe(1);
  });
});

describe('resolveForeground', () => {
  it('keeps a foreground that already passes', () => {
    // White on the default primary scores well above 4.5:1.
    expect(resolveForeground(WHITE, '#6750A4')).toBe(WHITE);
  });

  it('replaces a failing foreground with whichever neutral reads better', () => {
    // The motivating case: a white caption over a yellow brand bar.
    expect(resolveForeground(WHITE, '#FFEB3B')).toBe(BLACK);
    expect(resolveForeground(BLACK, '#1C1B1F')).toBe(WHITE);
  });

  it('substitutes rather than painting an unparseable color', () => {
    expect(resolveForeground('nonsense', WHITE)).toBe(BLACK);
  });

  it('leaves the default theme legible out of the box', () => {
    // onPrimary over primary, and text over surface.
    expect(resolveForeground('#FFFFFF', '#6750A4')).toBe('#FFFFFF');
    expect(resolveForeground('#1C1B1F', '#FFFFFF')).toBe('#1C1B1F');
  });

  it('warns once per pair in development, naming the substitute', () => {
    resolveForeground(WHITE, '#FFEB3B');
    resolveForeground(WHITE, '#FFEB3B');

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect((console.warn as jest.Mock).mock.calls[0][0]).toContain('#FFEB3B');
  });

  it('does not warn when the configured color is honoured', () => {
    resolveForeground(WHITE, '#6750A4');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('memoizes per (background, foreground) pair', () => {
    const first = resolveForeground(WHITE, '#FFEB3B');
    const second = resolveForeground(WHITE, '#FFEB3B');
    expect(second).toBe(first);

    // The same foreground against a different background is a different answer.
    expect(resolveForeground(WHITE, '#6750A4')).toBe(WHITE);
  });
});
