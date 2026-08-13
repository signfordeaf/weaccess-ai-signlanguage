import {
  advanceIndex,
  lineIndexAt,
  lineStarts,
  offsetAtPoint,
  segmentIndexAtPoint,
  type TextLayoutLine,
} from '../charOffset';
import { splitSentences } from '../../core/sentenceSplitter';

/** Build layout lines for a text broken at the given pieces. */
const layout = (pieces: string[], lineHeight = 16): TextLayoutLine[] =>
  pieces.map((piece, index) => ({
    x: 0,
    y: index * lineHeight,
    width: piece.length * 7,
    height: lineHeight,
    text: piece,
  }));

describe('advanceIndex', () => {
  const sample = 'Merhaba dünya';

  it('is monotonic in the fraction', () => {
    let previous = -1;
    for (let f = 0; f <= 1; f += 0.05) {
      const index = advanceIndex(sample, f);
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  it('pins both ends', () => {
    expect(advanceIndex(sample, 0)).toBe(0);
    expect(advanceIndex(sample, 1)).toBe(sample.length);
  });

  it('handles an empty line', () => {
    expect(advanceIndex('', 0.5)).toBe(0);
  });

  it('accounts for narrow and wide glyphs', () => {
    // A run of narrow characters advances further per unit width than wide ones.
    expect(advanceIndex('iiiiiiiiii', 0.5)).toBeGreaterThanOrEqual(4);
    expect(advanceIndex('mmmmmmmmmm', 0.5)).toBeGreaterThanOrEqual(4);
  });
});

describe('lineStarts', () => {
  it('recovers where each line begins', () => {
    const full = 'Birinci satır ikinci satır';
    const lines = layout(['Birinci satır ', 'ikinci satır']);

    expect(lineStarts(full, lines)).toEqual([0, 14]);
  });

  it('reports null when the lines no longer describe the text', () => {
    // Stale layout, or an ellipsised line whose text is not verbatim.
    const lines = layout(['Something else']);
    expect(lineStarts('Merhaba dünya', lines)).toBeNull();
  });
});

describe('lineIndexAt', () => {
  const lines = layout(['bir', 'iki', 'üç']);

  it('picks the line containing y exactly', () => {
    expect(lineIndexAt(lines, 0)).toBe(0);
    expect(lineIndexAt(lines, 15)).toBe(0);
    expect(lineIndexAt(lines, 16)).toBe(1);
    expect(lineIndexAt(lines, 33)).toBe(2);
  });

  it('clamps above and below', () => {
    expect(lineIndexAt(lines, -50)).toBe(0);
    expect(lineIndexAt(lines, 5000)).toBe(2);
  });
});

describe('offsetAtPoint', () => {
  const full = 'Birinci satır ikinci satır';
  const lines = layout(['Birinci satır ', 'ikinci satır']);

  it('lands on the correct line', () => {
    const first = offsetAtPoint(full, lines, 0, 4)!;
    const second = offsetAtPoint(full, lines, 0, 20)!;

    expect(first).toBeLessThan(14);
    expect(second).toBeGreaterThanOrEqual(14);
  });

  it('clamps x at both ends of a line', () => {
    expect(offsetAtPoint(full, lines, -100, 4)).toBe(0);
    expect(offsetAtPoint(full, lines, 100000, 4)).toBe(14);
  });

  it('always returns an offset inside the text', () => {
    for (let x = -20; x < 200; x += 7) {
      for (const y of [0, 8, 16, 24]) {
        const offset = offsetAtPoint(full, lines, x, y);
        expect(offset).not.toBeNull();
        expect(offset!).toBeGreaterThanOrEqual(0);
        expect(offset!).toBeLessThanOrEqual(full.length);
      }
    }
  });

  it.each([
    ['no lines', [] as TextLayoutLine[]],
    ['stale lines', layout(['Something else'])],
  ])('returns null for %s', (_label, lines_) => {
    expect(offsetAtPoint(full, lines_, 10, 4)).toBeNull();
  });

  it('returns the line start for a zero-width line', () => {
    const empty: TextLayoutLine[] = [
      { x: 0, y: 0, width: 0, height: 16, text: '' },
    ];
    expect(offsetAtPoint('abc', empty, 5, 4)).toBe(0);
  });
});

describe('segmentIndexAtPoint', () => {
  const full = 'Birinci cümle burada. İkinci cümle burada. Üçüncü cümle.';
  const ranges = splitSentences(full);

  it('is exact when the tapped line lies inside one sentence', () => {
    // The line contains no boundary, so x is never consulted.
    const lines = layout([
      'Birinci cümle ',
      'burada. İkinci ',
      'cümle burada. ',
    ]);

    // Any x on the first line must give sentence 0.
    for (const x of [0, 20, 60, 999]) {
      expect(segmentIndexAtPoint(full, ranges, lines, x, 4)).toBe(0);
    }
  });

  it('consults the position when a boundary falls inside the line', () => {
    const lines = layout(['Birinci cümle burada. İkinci cümle burada. ']);

    const left = segmentIndexAtPoint(full, ranges, lines, 0, 4);
    const right = segmentIndexAtPoint(full, ranges, lines, 280, 4);

    expect(left).toBe(0);
    expect(right).toBeGreaterThan(0);
  });

  it('reports not found when it cannot tell', () => {
    expect(segmentIndexAtPoint(full, ranges, [], 0, 0)).toBe(-1);
    expect(
      segmentIndexAtPoint(full, ranges, layout(['Different text']), 0, 0)
    ).toBe(-1);
    expect(segmentIndexAtPoint(full, [], layout([full]), 0, 0)).toBe(-1);
  });

  it('never returns an index outside the range list', () => {
    const lines = layout(['Birinci cümle burada. ', 'İkinci cümle burada. ']);

    for (const x of [-100, 0, 50, 5000]) {
      for (const y of [-10, 4, 20, 500]) {
        const index = segmentIndexAtPoint(full, ranges, lines, x, y);
        expect(index).toBeGreaterThanOrEqual(-1);
        expect(index).toBeLessThan(ranges.length);
      }
    }
  });
});
