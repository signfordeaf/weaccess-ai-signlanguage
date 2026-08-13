/**
 * Sensitive data.
 *
 * Text containing personal data is never sent to the translation backend. Two
 * layers of defence: patterns the SDK detects on its own, and text the host app
 * marked explicitly.
 *
 * The check runs per segment, immediately before the request, on the exact
 * string that would have been sent. One clause carrying an ID number blocks
 * only itself; the rest of the paragraph stays translatable.
 *
 * The automatic layer is a **safety net, not a guarantee**. It is tuned for
 * Turkish personal data and general PII; it does not detect addresses, names,
 * account numbers in unusual formats, or personal data expressed in prose.
 * Hosts that know their content is sensitive must mark it explicitly.
 */

/** Why a piece of text was refused. Useful in logs; never shown to the user. */
export type SensitiveReason =
  | 'marked'
  | 'email'
  | 'iban'
  | 'phone'
  | 'nationalId'
  | 'card';

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/** `TR` + 24 digits, spaces allowed between groups. */
const IBAN = /\bTR\d{2}(?:[ ]?\d{4}){5}[ ]?\d{2}\b/i;

/** Optional `+90`/`0` prefix, spaces allowed. */
const PHONE = /(?:\+90|0)?[ ]?5\d{2}[ ]?\d{3}[ ]?\d{2}[ ]?\d{2}/;

const NATIONAL_ID_CANDIDATE = /\b\d{11}\b/g;
const CARD_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;

/**
 * Turkish national identity number (TCKN) checksum.
 *
 * The checksum matters: without it every 11-digit order number, reference code
 * or timestamp on the page would be refused, and users would conclude the SDK
 * is broken.
 */
export const isTurkishNationalId = (value: string): boolean => {
  if (!/^\d{11}$/.test(value)) return false;

  const d = [...value].map(Number) as number[];
  if (d[0] === 0) return false;

  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const even = d[1]! + d[3]! + d[5]! + d[7]!;

  // JavaScript's `%` follows the sign of the dividend, so `odd * 7 - even` can
  // produce a negative remainder here. A plain `% 10` would let valid identity
  // numbers slip through.
  const check = (((odd * 7 - even) % 10) + 10) % 10;
  if (d[9] !== check) return false;

  const total = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0);
  return d[10] === total % 10;
};

/**
 * Luhn: from the rightmost digit leftwards, double every second digit,
 * subtract 9 from any result above 9, sum everything; valid when the total is
 * divisible by 10.
 */
export const passesLuhn = (digits: string): boolean => {
  if (!/^\d+$/.test(digits)) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
};

// ---------------------------------------------------------------------------
// Manual marking
// ---------------------------------------------------------------------------

/**
 * The process-wide registry of text the host marked as sensitive.
 *
 * Marked text stays visible and selectable on screen — only *translation* is
 * refused.
 *
 * Entries are reference-counted so two marked regions carrying the same string
 * do not clear each other's registration when one of them unmounts.
 */
class SensitiveRegistry {
  private counts = new Map<string, number>();

  /**
   * Register some strings, returning the function that removes exactly these
   * registrations again.
   *
   * Empty and whitespace-only strings are ignored; entries are trimmed before
   * storage.
   */
  register(texts: readonly string[]): () => void {
    const added = texts
      .map((text) => text.trim())
      .filter((text) => text.length > 0);

    for (const text of added) {
      this.counts.set(text, (this.counts.get(text) ?? 0) + 1);
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;

      for (const text of added) {
        const count = this.counts.get(text);
        if (count === undefined) continue;
        if (count <= 1) this.counts.delete(text);
        else this.counts.set(text, count - 1);
      }
    };
  }

  /**
   * Whether `candidate` overlaps a marked string.
   *
   * Matching is two-way containment: the user may select all, part, or more
   * than the marked region, and every one of those must be refused.
   */
  matches(candidate: string): boolean {
    const trimmed = candidate.trim();
    if (!trimmed) return false;

    for (const marked of this.counts.keys()) {
      if (trimmed.includes(marked) || marked.includes(trimmed)) return true;
    }
    return false;
  }

  /** Everything currently registered. Exported for tests and debugging. */
  get entries(): string[] {
    return [...this.counts.keys()];
  }

  clear(): void {
    this.counts.clear();
  }
}

export const sensitiveRegistry = new SensitiveRegistry();

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const anyMatchPasses = (
  text: string,
  pattern: RegExp,
  accept: (match: string) => boolean
): boolean => {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (accept(match[0]!)) return true;
  }
  return false;
};

/**
 * Why `text` is sensitive, or `null` if it is not.
 *
 * Evaluation order is deliberate: the checksum-validated patterns come last
 * because they are the expensive ones. First match wins.
 */
export const detectSensitive = (text: string): SensitiveReason | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (sensitiveRegistry.matches(trimmed)) return 'marked';
  if (EMAIL.test(trimmed)) return 'email';
  if (IBAN.test(trimmed)) return 'iban';
  if (PHONE.test(trimmed)) return 'phone';

  if (anyMatchPasses(trimmed, NATIONAL_ID_CANDIDATE, isTurkishNationalId)) {
    return 'nationalId';
  }

  const cardAccepts = (match: string) => {
    // Spaces and dashes stripped, then 13-19 digits validated by Luhn.
    const digits = match.replace(/[ -]/g, '');
    return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits);
  };
  if (anyMatchPasses(trimmed, CARD_CANDIDATE, cardAccepts)) return 'card';

  return null;
};

/** Whether `text` must not leave the device. */
export const isSensitive = (text: string): boolean =>
  detectSensitive(text) !== null;
