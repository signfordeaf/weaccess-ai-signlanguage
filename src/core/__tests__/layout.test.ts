import { computePlayerLayout, captionBlockHeight } from '../layout';
import { SIZE } from '../tokens';

// The three screen sizes the sizing algorithm publishes worked results for.
// Every port is expected to hold these with a regression test.
const SCREENS = [
  { name: '393x852', width: 393, height: 852, stage: [212, 195], total: 331 },
  { name: '375x667', width: 375, height: 667, stage: [157, 145], total: 280 },
  { name: '360x640', width: 360, height: 640, stage: [145, 133], total: 269 },
] as const;

describe('computePlayerLayout', () => {
  describe('the published worked results', () => {
    it.each(SCREENS)(
      '$name sizes the stage to $stage and the player to $total tall',
      ({ height, stage, total }) => {
        const layout = computePlayerLayout({ screenHeight: height });

        expect(Math.round(layout.stageWidth)).toBe(stage[0]);
        expect(Math.round(layout.stageHeight)).toBe(stage[1]);
        expect(Math.round(layout.totalHeight)).toBe(total);
      }
    );
  });

  describe('size invariants', () => {
    // These are the point of the whole budget: the first design of this player
    // took 72% x 64%, which defeated the point of dropping the scrim.
    it.each(SCREENS)(
      '$name keeps the player within 42% height and 65% width',
      ({ width, height }) => {
        const layout = computePlayerLayout({ screenHeight: height });

        expect(layout.totalHeight).toBeLessThanOrEqual(
          height * SIZE.maxPlayerScreenFraction
        );
        expect(layout.totalWidth).toBeLessThan(width * 0.65);
      }
    );

    it.each(SCREENS)(
      '$name holds the invariants at a raised text scale',
      ({ width, height }) => {
        const layout = computePlayerLayout({
          screenHeight: height,
          fontScale: 1.5,
        });

        expect(layout.totalHeight).toBeLessThanOrEqual(
          height * SIZE.maxPlayerScreenFraction
        );
        expect(layout.totalWidth).toBeLessThan(width * 0.65);
      }
    );
  });

  it('reports a compact height exactly one caption block shorter', () => {
    // The caption is drawn only once there is a sentence for it, but it stays
    // budgeted above so the stage does not resize when text arrives.
    const layout = computePlayerLayout({ screenHeight: 852 });

    expect(layout.totalHeight - layout.compactHeight).toBeCloseTo(
      layout.captionBlockHeight,
      5
    );
  });

  it('sizes the stage identically whether or not a caption is showing', () => {
    // There is only one stage size: the compact form is the same player with
    // the bottom block left undrawn.
    const layout = computePlayerLayout({ screenHeight: 852 });
    expect(layout.stageHeight).toBeGreaterThan(0);
    expect(layout.compactHeight).toBeLessThan(layout.totalHeight);
  });

  it('reserves the caption block before there is a caption', () => {
    // 12 * 1.35 * 2 + 8 * 2
    expect(captionBlockHeight(1)).toBeCloseTo(48.4, 5);
  });

  it('grows the caption block with the system text scale', () => {
    const base = computePlayerLayout({ screenHeight: 852 });
    const scaled = computePlayerLayout({ screenHeight: 852, fontScale: 2 });

    expect(scaled.captionBlockHeight).toBeGreaterThan(base.captionBlockHeight);
    // A bigger caption comes out of the stage, not out of the screen budget.
    expect(scaled.stageHeight).toBeLessThanOrEqual(base.stageHeight);
  });

  it('assumes the bundled clips ratio before a video reports one', () => {
    const assumed = computePlayerLayout({ screenHeight: 852 });
    const reported = computePlayerLayout({
      screenHeight: 852,
      aspect: 900 / 828,
    });

    // The stage must not resize under the user when the real video arrives at
    // the same ratio as the idle loop.
    expect(assumed.stageWidth).toBeCloseTo(reported.stageWidth, 5);
    expect(assumed.stageHeight).toBeCloseTo(reported.stageHeight, 5);
  });

  it.each([0, -1, NaN, Infinity])(
    'falls back to the assumed ratio for a nonsense aspect (%p)',
    (aspect) => {
      const layout = computePlayerLayout({ screenHeight: 852, aspect });
      expect(layout.aspect).toBeCloseTo(900 / 828, 5);
      expect(layout.stageWidth).toBeGreaterThan(0);
    }
  );

  it('caps a landscape video by width, not height', () => {
    const layout = computePlayerLayout({ screenHeight: 852, aspect: 16 / 9 });

    expect(layout.stageWidth).toBeLessThanOrEqual(212);
    expect(layout.stageHeight).toBeLessThan(
      computePlayerLayout({ screenHeight: 852 }).stageHeight
    );
  });

  it('never lets the stage fall below the three-control floor', () => {
    // A portrait video on a very short screen is what pushes the height cap
    // below what three 44 pt controls need.
    const layout = computePlayerLayout({ screenHeight: 480, aspect: 0.5 });

    expect(layout.stageWidth).toBeGreaterThanOrEqual(SIZE.minStageWidth);
    expect(layout.barWidth).toBeGreaterThanOrEqual(3 * SIZE.control);
  });

  describe('control bar width', () => {
    it('matches the stage exactly at the default control count', () => {
      const layout = computePlayerLayout({ screenHeight: 852 });
      expect(layout.barWidth).toBeCloseTo(layout.stageWidth, 5);
    });

    it('grows rather than clips when a control needs more room', () => {
      const layout = computePlayerLayout({
        screenHeight: 480,
        aspect: 0.5,
        controlCount: 4,
      });

      expect(layout.barWidth).toBeGreaterThanOrEqual(4 * SIZE.control);
      expect(layout.totalWidth).toBe(layout.barWidth);
    });
  });

  it('renders something on a pathologically short screen', () => {
    const layout = computePlayerLayout({ screenHeight: 200 });

    expect(layout.stageHeight).toBeGreaterThan(0);
    expect(layout.stageWidth).toBeGreaterThan(0);
  });
});
