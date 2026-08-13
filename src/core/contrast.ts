/**
 * Contrast enforcement.
 *
 * The host chooses `primaryColor` and `surfaceColor` freely, and pairs them
 * with a foreground guessed at configuration time. A white caption over a
 * yellow brand bar is unreadable, and unreadable is a defect here, not a
 * styling opinion.
 *
 * Rule: before painting any foreground on a configured background, compute the
 * WCAG 2.1 contrast ratio. Below 4.5:1, replace the foreground with black or
 * white — whichever scores higher against that background.
 */

/** The WCAG AA threshold for normal text. */
export const MIN_CONTRAST_RATIO = 4.5;

export const BLACK = '#000000';
export const WHITE = '#FFFFFF';

/** An opaque color as 8-bit channels. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX8 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_FN =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i;

/**
 * Parse a CSS-ish color into RGB channels, ignoring any alpha.
 *
 * Alpha is dropped rather than composited because the SDK only ever measures a
 * foreground against a background it also controls; a translucent foreground
 * over an unknown backdrop is not a case the contrast guard can answer, and
 * guessing would be worse than measuring the solid color.
 *
 * Returns `null` for anything unparseable so callers can fall back rather than
 * throw — a bad color in a host's theme must not break the player.
 */
export const parseColor = (color: string): Rgb | null => {
  if (typeof color !== 'string') return null;
  const value = color.trim();

  const short = HEX3.exec(value);
  if (short) {
    return {
      r: parseInt(short[1]! + short[1]!, 16),
      g: parseInt(short[2]! + short[2]!, 16),
      b: parseInt(short[3]! + short[3]!, 16),
    };
  }

  // #RRGGBBAA is tested before #RRGGBB so the longer form wins.
  const long = HEX8.exec(value) ?? HEX6.exec(value);
  if (long) {
    return {
      r: parseInt(long[1]!, 16),
      g: parseInt(long[2]!, 16),
      b: parseInt(long[3]!, 16),
    };
  }

  const fn = RGB_FN.exec(value);
  if (fn) {
    const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    return {
      r: clamp255(Number(fn[1])),
      g: clamp255(Number(fn[2])),
      b: clamp255(Number(fn[3])),
    };
  }

  return null;
};

/** WCAG 2.1 relative luminance. */
export const relativeLuminance = ({ r, g, b }: Rgb): number => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/**
 * WCAG 2.1 contrast ratio, running from 1 (identical) to 21 (black on white).
 *
 * Symmetric in its arguments by construction — the brighter color is always
 * the numerator.
 */
export const contrastRatio = (a: string, b: string): number => {
  const ca = parseColor(a);
  const cb = parseColor(b);
  // An unparseable color cannot be measured. Report the worst possible ratio
  // so the caller substitutes rather than painting something unreadable.
  if (!ca || !cb) return 1;

  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Whichever of black or white reads better against `background`. */
const bestNeutralOn = (background: string): string =>
  contrastRatio(WHITE, background) >= contrastRatio(BLACK, background)
    ? WHITE
    : BLACK;

// Resolution is pure and the inputs rarely change, so results are cached per
// (background, foreground) pair rather than recomputed every frame.
const cache = new Map<string, string>();
const warned = new Set<string>();

/**
 * Resolve a foreground for painting on `background`.
 *
 * Returns the configured `foreground` when it already meets 4.5:1, and
 * otherwise black or white — whichever scores higher. Every foreground the SDK
 * paints on a configured background MUST go through here rather than reading
 * the theme directly.
 */
export const resolveForeground = (
  foreground: string,
  background: string
): string => {
  const key = `${background}|${foreground}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const ratio = contrastRatio(foreground, background);
  let resolved = foreground;

  if (ratio < MIN_CONTRAST_RATIO) {
    resolved = bestNeutralOn(background);

    // Silently ignoring the configured color leaves integrators wondering why
    // their brand foreground never appears — so say so, once per pair, and
    // only in development.
    if (__DEV__ && !warned.has(key)) {
      warned.add(key);
      console.warn(
        `[SignLanguage] Foreground ${foreground} on ${background} scores ` +
          `${ratio.toFixed(2)}:1, below the ${MIN_CONTRAST_RATIO}:1 minimum. ` +
          `Using ${resolved} instead.`
      );
    }
  }

  cache.set(key, resolved);
  return resolved;
};

/** Drop the memoized results. Exported for tests. */
export const clearContrastCache = (): void => {
  cache.clear();
  warned.clear();
};
