/**
 * Turning a touch position into a character offset.
 *
 * This is what lets the tapped *sentence* be picked out of
 * a paragraph. It is deliberately separable and degradable: everything else in
 * `tap/` works without it, and its absence lands on the whole-paragraph
 * whole-paragraph fallback.
 *
 * ## What is exact and what is estimated
 *
 * **Vertical line selection is exact** — `onTextLayout` reports a real rect per
 * line, and line starts are recovered by matching each line's own text back
 * into the flattened string.
 *
 * **Horizontal position within a line is estimated.** No per-glyph metrics are
 * exposed to JavaScript, so this uses a static relative-advance table: roughly
 * ±1–2 characters for Latin and Turkish, worse for scripts it was not tuned
 * for.
 *
 * That is sufficient, because the caller consults the estimate **only when a
 * sentence boundary actually falls inside the tapped line**. For ordinary prose
 * — sentences of 100–250 characters, lines of ~40 — most lines contain no
 * boundary at all and the answer is exact without `x` being used.
 */

import type { SegmentRange } from '../core/sentenceSplitter';
import { indexForOffset } from '../core/sentenceSplitter';

/** One entry of `onTextLayout`'s `nativeEvent.lines`. */
export interface TextLayoutLine {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

// Relative advances, tuned for Latin and Turkish. Not a font metric — a
// tie-breaker that beats assuming every character is the same width.
const NARROW = new Set([...`iIl1|!.,;:'\`()[]{}jtfr `]);
const WIDE = new Set([...'mwMW@%—–']);

const advanceOf = (character: string): number =>
  NARROW.has(character) ? 0.35 : WIDE.has(character) ? 0.9 : 0.55;

/** The index `fraction` of the way along `text`, weighted by advance. */
export const advanceIndex = (text: string, fraction: number): number => {
  if (!text.length) return 0;

  let total = 0;
  for (const character of text) total += advanceOf(character);

  const wanted = fraction * total;
  let run = 0;
  for (let i = 0; i < text.length; i++) {
    run += advanceOf(text[i]!);
    // Strictly greater, so the result is the *insertion point* under the
    // finger: a tap past the last glyph lands after it, not on it.
    if (run > wanted) return i;
  }
  return text.length;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Where each line begins in `fullText`.
 *
 * Returns `null` when the lines no longer describe the text — stale layout, or
 * an ellipsised line whose reported text does not appear verbatim. That is the
 * staleness check as much as it is the calculation.
 */
export const lineStarts = (
  fullText: string,
  lines: readonly TextLayoutLine[]
): number[] | null => {
  const starts: number[] = [];
  let cursor = 0;

  for (const line of lines) {
    const at = fullText.indexOf(line.text, cursor);
    if (at < 0) return null;
    starts.push(at);
    cursor = at + line.text.length;
  }

  return starts;
};

/** The index of the line containing `y`, clamped to the first or last. */
export const lineIndexAt = (
  lines: readonly TextLayoutLine[],
  y: number
): number => {
  const found = lines.findIndex(
    (line) => y >= line.y && y < line.y + line.height
  );
  if (found >= 0) return found;
  return y < (lines[0]?.y ?? 0) ? 0 : lines.length - 1;
};

/**
 * The character offset under `(x, y)`, or `null` when it cannot be determined.
 *
 * `null` is not a failure — the caller falls back to translating the whole
 * paragraph, which is exactly the v1 behavior.
 */
export const offsetAtPoint = (
  fullText: string,
  lines: readonly TextLayoutLine[],
  x: number,
  y: number
): number | null => {
  if (!lines.length || !fullText.length) return null;

  const starts = lineStarts(fullText, lines);
  if (!starts) return null;

  const index = lineIndexAt(lines, y);
  const line = lines[index];
  const start = starts[index];
  if (!line || start === undefined) return null;

  if (!(line.width > 0) || !line.text.length) return start;

  const fraction = clamp((x - line.x) / line.width, 0, 1);
  return start + advanceIndex(line.text, fraction);
};

/**
 * Which segment was tapped.
 *
 * Takes the exact answer whenever the tapped line lies wholly inside one
 * segment, and only consults the estimated horizontal position when a boundary
 * actually falls within that line.
 *
 * Returns `-1` when it cannot tell, which the caller reads as "translate the
 * whole paragraph".
 */
export const segmentIndexAtPoint = (
  fullText: string,
  ranges: readonly SegmentRange[],
  lines: readonly TextLayoutLine[],
  x: number,
  y: number
): number => {
  if (!ranges.length) return -1;
  if (!lines.length) return -1;

  const starts = lineStarts(fullText, lines);
  if (!starts) return -1;

  const index = lineIndexAt(lines, y);
  const line = lines[index];
  const start = starts[index];
  if (!line || start === undefined) return -1;

  const end = start + Math.max(0, line.text.length - 1);

  const atStart = indexForOffset(ranges as SegmentRange[], start);
  const atEnd = indexForOffset(ranges as SegmentRange[], end);

  // No boundary inside this line: x is irrelevant and the answer is exact.
  if (atStart >= 0 && atStart === atEnd) return atStart;

  const offset = offsetAtPoint(fullText, lines, x, y);
  return offset == null ? -1 : indexForOffset(ranges as SegmentRange[], offset);
};
