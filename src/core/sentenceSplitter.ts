/**
 * Sentence segmentation.
 *
 * A tap translates the sentence under the finger, not the whole paragraph. On
 * a long legal clause the difference is a minutes-long video and a request
 * that polls for half a minute versus a few seconds of signing.
 *
 * There is no ICU sentence breaker in play — the rules below are explicit, and
 * a port must reproduce them rather than substitute a platform tokenizer.
 * Platform breakers disagree on exactly the constructs these rules were tuned
 * for (`T.C.`, `A.Ş.`, `5.000.000 TL`, numbered clauses), and a different
 * split changes what is sent to the backend and what the cache keys on.
 *
 * ## The losslessness invariant
 *
 * The ranges returned for a text partition `[0, length)` exactly: concatenating
 * them reproduces the input character for character. Trailing whitespace
 * belongs to the segment that precedes it, so a sentence can never go missing —
 * the worst a bad rule can do is put a boundary in the wrong place. Every later
 * step only ever adds or removes boundaries, never characters.
 */

/** A half-open character range, `[start, end)`. */
export interface SegmentRange {
  start: number;
  end: number;
}

export const DEFAULT_MAX_SEGMENT_CHARS = 900;

// ---------------------------------------------------------------------------
// Character helpers
//
// Two definitions a port must get right rather than assume.
// ---------------------------------------------------------------------------

/**
 * A letter is a character whose lowercase and uppercase forms differ.
 *
 * This is what keeps Turkish `ı/İ` and `ş/Ş` working without a locale-specific
 * alphabet. Note the consequence: uncased scripts such as Arabic contain no
 * "letters" by this definition, so the short-fragment merge and the
 * sentence-start test behave differently there. That is deliberate — the rules
 * were tuned for Latin-script Turkish, and Arabic falls back to
 * whole-paragraph behavior rather than being mis-split.
 */
export const isLetter = (ch: string): boolean =>
  ch.toLowerCase() !== ch.toUpperCase();

/** An uppercase letter is a letter equal to its own uppercase form. */
export const isUpperLetter = (ch: string): boolean =>
  isLetter(ch) && ch === ch.toUpperCase();

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

/** Whitespace for these purposes: space, LF, TAB, CR and NBSP. */
const WHITESPACE = new Set([' ', '\n', '\t', '\r', '\u00A0']);
const isWhitespace = (ch: string): boolean => WHITESPACE.has(ch);

const TERMINATORS = new Set(['.', '!', '?', '…']);

/** Skipped after a terminator, so `(…gibi.)` and `“…gitti.”` still break. */
const CLOSERS = new Set([')', ']', '}', '"', "'", '»', '”', '’']);

/** A sentence may open with one of these. */
const OPENERS = new Set([
  '(',
  '[',
  '{',
  '"',
  "'",
  '«',
  '“',
  '‘',
  '-',
  '–',
  '—',
]);

const looksLikeSentenceStart = (ch: string): boolean =>
  isDigit(ch) || OPENERS.has(ch) || isUpperLetter(ch);

/**
 * Turkish abbreviations, multi-letter only — single-letter initialisms are
 * handled structurally. These entries are what makes Turkish banking and legal
 * prose split correctly; a port may extend the list per language but must keep
 * them.
 */
export const ABBREVIATIONS = new Set([
  'vb',
  'vs',
  'vd',
  'bkz',
  'örn',
  'age',
  'çev',
  'haz',
  'ed',
  'dr',
  'doç',
  'prof',
  'av',
  'sn',
  'bay',
  'bayan',
  'öğr',
  'gör',
  'arş',
  'ltd',
  'şti',
  'tic',
  'san',
  'md',
  'gen',
  'alb',
  'yzb',
  'ütğm',
  'mah',
  'cad',
  'sok',
  'apt',
  'blv',
  'no',
  'tel',
  'faks',
  'kat',
  'üniv',
  'fak',
  'böl',
  'ans',
  'yy',
  'mö',
  'ms',
]);

/** Conjunctions that open the clause they belong to, used by length chunking. */
const CONJUNCTIONS = [
  'ancak',
  'fakat',
  'çünkü',
  'veya',
  'ya da',
  've',
  'ise',
  'ki',
];

/** Punctuation a chunk may be cut just after. */
const CLAUSE_PUNCTUATION = new Set([',', ';', ':', '—', '–']);

// ---------------------------------------------------------------------------
// Boundary detection
// ---------------------------------------------------------------------------

/** Advance past a whitespace run starting at `from`. */
const skipWhitespace = (text: string, from: number): number => {
  let i = from;
  while (i < text.length && isWhitespace(text[i]!)) i++;
  return i;
};

/**
 * Whether the `.` at `index` genuinely ends a sentence.
 *
 * `!`, `?` and `…` are unambiguous; only `.` needs this.
 */
const periodEndsSentence = (
  text: string,
  index: number,
  segmentStart: number
): boolean => {
  // Decimal / thousands separator: a digit on both sides. `5.000.000`, `1.2`.
  if (
    index > 0 &&
    isDigit(text[index - 1]!) &&
    index + 1 < text.length &&
    isDigit(text[index + 1]!)
  ) {
    return false;
  }

  // Initialism: preceded by a lone uppercase letter, i.e. the character before
  // *that* is not a letter. `T.C.`, `A.Ş.`
  if (index > 0 && isUpperLetter(text[index - 1]!)) {
    const before = index - 2;
    if (before < 0 || !isLetter(text[before]!)) return false;
  }

  // Known abbreviation: the letter run before the period is in the list.
  let runStart = index;
  while (runStart > 0 && isLetter(text[runStart - 1]!)) runStart--;
  if (runStart < index) {
    const run = text.slice(runStart, index).toLowerCase();
    if (ABBREVIATIONS.has(run)) return false;
  }

  // List marker: only digits and periods precede it, and everything from the
  // start of the current segment up to that number is whitespace.
  // `7. Para yatırma…`
  let markerStart = index;
  let sawDigit = false;
  while (markerStart > segmentStart) {
    const ch = text[markerStart - 1]!;
    if (isDigit(ch)) {
      sawDigit = true;
      markerStart--;
    } else if (ch === '.') {
      markerStart--;
    } else {
      break;
    }
  }
  if (sawDigit) {
    let onlyWhitespaceBefore = true;
    for (let i = segmentStart; i < markerStart; i++) {
      if (!isWhitespace(text[i]!)) {
        onlyWhitespaceBefore = false;
        break;
      }
    }
    if (onlyWhitespaceBefore) return false;
  }

  return true;
};

/**
 * Find the sentence boundaries of `text`.
 *
 * Returns the indices at which a segment ends, each placed *after* the
 * trailing whitespace — which is what keeps the partition lossless.
 */
const findBoundaries = (text: string): number[] => {
  const boundaries: number[] = [];
  let segmentStart = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;

    // A hard line break always starts a new sentence.
    if (ch === '\n') {
      const next = skipWhitespace(text, i);
      if (next < text.length) {
        boundaries.push(next);
        segmentStart = next;
      }
      i = Math.max(next, i + 1);
      continue;
    }

    if (!TERMINATORS.has(ch)) {
      i++;
      continue;
    }

    // A terminator only ends a sentence when what follows actually looks like
    // one starting.
    if (ch === '.' && !periodEndsSentence(text, i, segmentStart)) {
      i++;
      continue;
    }

    let after = i + 1;
    while (after < text.length && CLOSERS.has(text[after]!)) after++;

    // A terminator glued to the next character (`3.5`, `dosya.txt`) never ends
    // a sentence, and neither does one at the very end of the text.
    if (after >= text.length || !isWhitespace(text[after]!)) {
      i++;
      continue;
    }

    const next = skipWhitespace(text, after);
    if (next >= text.length || !looksLikeSentenceStart(text[next]!)) {
      i++;
      continue;
    }

    boundaries.push(next);
    segmentStart = next;
    i = next;
  }

  return boundaries;
};

const rangesFromBoundaries = (
  length: number,
  boundaries: number[]
): SegmentRange[] => {
  const ranges: SegmentRange[] = [];
  let start = 0;
  for (const boundary of boundaries) {
    if (boundary > start) {
      ranges.push({ start, end: boundary });
      start = boundary;
    }
  }
  if (start < length) ranges.push({ start, end: length });
  return ranges;
};

// ---------------------------------------------------------------------------
// Short-fragment merging
// ---------------------------------------------------------------------------

const countCasedLetters = (text: string, range: SegmentRange): number => {
  let count = 0;
  for (let i = range.start; i < range.end; i++) {
    if (isLetter(text[i]!)) {
      count++;
      if (count >= 2) return count;
    }
  }
  return count;
};

/**
 * Merge fragments too short to stand alone into a neighbour.
 *
 * A lone bullet, a dangling quote or a stray number is not a sentence. A tail
 * too short to stand alone is appended to the previous segment instead.
 * Dropping a boundary only ever joins neighbours, so this stays lossless.
 */
const mergeShortFragments = (
  text: string,
  ranges: SegmentRange[]
): SegmentRange[] => {
  const merged = [...ranges];
  let i = 0;

  while (i < merged.length && merged.length > 1) {
    if (countCasedLetters(text, merged[i]!) >= 2) {
      i++;
      continue;
    }

    if (i < merged.length - 1) {
      // Join forward. The result is larger, so re-checking it terminates.
      merged.splice(i, 2, { start: merged[i]!.start, end: merged[i + 1]!.end });
    } else {
      merged.splice(i - 1, 2, {
        start: merged[i - 1]!.start,
        end: merged[i]!.end,
      });
      break;
    }
  }

  return merged;
};

// ---------------------------------------------------------------------------
// Length chunking
// ---------------------------------------------------------------------------

/** Cut candidates just after clause punctuation, landing after the whitespace. */
const punctuationCuts = (
  text: string,
  { start, end }: SegmentRange
): number[] => {
  const cuts: number[] = [];
  for (let i = start; i < end; i++) {
    const ch = text[i]!;
    const isClause =
      CLAUSE_PUNCTUATION.has(ch) ||
      // A bare hyphen only counts when it stands as a dash.
      (ch === '-' && i > start && isWhitespace(text[i - 1]!));
    if (!isClause) continue;
    if (i + 1 >= end || !isWhitespace(text[i + 1]!)) continue;

    const cut = skipWhitespace(text, i + 1);
    if (cut > start && cut < end) cuts.push(cut);
  }
  return cuts;
};

const startsWholeWord = (
  text: string,
  at: number,
  word: string,
  end: number
): boolean => {
  if (at + word.length > end) return false;
  if (text.slice(at, at + word.length).toLowerCase() !== word) return false;
  const after = at + word.length;
  return after >= end || isWhitespace(text[after]!);
};

/**
 * Cut candidates immediately *before* a coordinating conjunction, so the
 * conjunction opens the next chunk the way it opens the clause.
 */
const conjunctionCuts = (
  text: string,
  { start, end }: SegmentRange
): number[] => {
  const cuts: number[] = [];
  for (let i = start + 1; i < end; i++) {
    if (!isWhitespace(text[i - 1]!)) continue;
    if (CONJUNCTIONS.some((word) => startsWholeWord(text, i, word, end))) {
      cuts.push(i);
    }
  }
  return cuts;
};

/** Cut candidates after any whitespace run. */
const wordCuts = (text: string, { start, end }: SegmentRange): number[] => {
  const cuts: number[] = [];
  let i = start;
  while (i < end) {
    if (!isWhitespace(text[i]!)) {
      i++;
      continue;
    }
    const cut = skipWhitespace(text, i);
    if (cut > start && cut < end) cuts.push(cut);
    i = Math.max(cut, i + 1);
  }
  return cuts;
};

const closestToMiddle = (cuts: number[], middle: number): number =>
  cuts.reduce((best, cut) =>
    Math.abs(cut - middle) < Math.abs(best - middle) ? cut : best
  );

/**
 * Subdivide a range longer than `maxChars`.
 *
 * Sign language is not a word-for-word transcoding — Turkish Sign Language has
 * its own grammar — so cutting every N words produces clips that are
 * individually plausible and collectively wrong. Punctuation and conjunctions
 * are natural pauses in signing too.
 *
 * Recurses into *both* halves rather than peeling `maxChars` off the front,
 * which would leave a stub of a few words at the very end reading as a broken
 * fragment.
 */
const chunkRange = (
  text: string,
  range: SegmentRange,
  maxChars: number,
  out: SegmentRange[]
): void => {
  if (range.end - range.start <= maxChars) {
    out.push(range);
    return;
  }

  const middle = Math.floor((range.start + range.end) / 2);

  const candidates =
    firstNonEmpty(
      punctuationCuts(text, range),
      conjunctionCuts(text, range),
      wordCuts(text, range)
    ) ?? [];

  // Only when there is no usable boundary at all.
  const cut = candidates.length
    ? closestToMiddle(candidates, middle)
    : range.start + maxChars;

  chunkRange(text, { start: range.start, end: cut }, maxChars, out);
  chunkRange(text, { start: cut, end: range.end }, maxChars, out);
};

const firstNonEmpty = (...lists: number[][]): number[] | undefined =>
  lists.find((list) => list.length > 0);

const applyLengthLimit = (
  text: string,
  ranges: SegmentRange[],
  maxChars: number
): SegmentRange[] => {
  if (!(maxChars > 0)) return ranges;
  const out: SegmentRange[] = [];
  for (const range of ranges) chunkRange(text, range, maxChars, out);
  return out;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split `text` into sentences, then cap each at `maxChars`.
 *
 * Empty input yields no ranges; blank input yields one.
 */
export const splitSentences = (
  text: string,
  maxChars: number = DEFAULT_MAX_SEGMENT_CHARS
): SegmentRange[] => {
  if (!text.length) return [];

  const ranges = rangesFromBoundaries(text.length, findBoundaries(text));
  return applyLengthLimit(text, mergeShortFragments(text, ranges), maxChars);
};

/**
 * Paragraph granularity: the whole text as one segment, still length-capped.
 *
 * A 3000-character paragraph in one request breaks at the gateway; chunking is
 * the only way it reaches the user at all.
 */
export const splitByLength = (
  text: string,
  maxChars: number = DEFAULT_MAX_SEGMENT_CHARS
): SegmentRange[] => {
  if (!text.length) return [];
  return applyLengthLimit(text, [{ start: 0, end: text.length }], maxChars);
};

/**
 * Map a character offset to the range containing it.
 *
 * A tap past the last character belongs to the last sentence; anything else is
 * "not found" (`-1`), and the caller falls back to translating the whole
 * paragraph.
 */
export const indexForOffset = (
  ranges: SegmentRange[],
  offset: number
): number => {
  if (!ranges.length || offset < 0) return -1;

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!;
    if (offset >= range.start && offset < range.end) return i;
  }

  const last = ranges[ranges.length - 1]!;
  return offset >= last.end ? ranges.length - 1 : -1;
};

/**
 * Normalize a segment before it leaves the SDK.
 *
 * Collapsing whitespace is not cosmetic: the same sentence must always produce
 * the same request string, because that string is the cache key.
 */
export const normalizeSegment = (text: string): string =>
  text
    // The object-replacement character marks where inline non-text content
    // sat, inserted to keep indices aligned. It must not reach the API.
    .replace(/\uFFFC/g, ' ')
    .replace(/[ \n\t\r\u00A0]+/g, ' ')
    .trim();

/**
 * The segments of `text`, normalized and ready to send, with empty ones
 * dropped.
 */
export const segmentTexts = (text: string, ranges: SegmentRange[]): string[] =>
  ranges.map((range) => normalizeSegment(text.slice(range.start, range.end)));
