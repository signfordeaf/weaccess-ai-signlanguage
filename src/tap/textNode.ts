/**
 * Reading text out of the fiber tree, and deciding whether it is translatable.
 */

import { isHost, isHostText, hostType, subtree, type Fiber } from './fiber';

/**
 * View-config names for text.
 *
 * `Text` is the name the React Native jest preset renders, and keeping it here
 * is not a test-only accommodation: it also means a renamed view config
 * degrades to "still recognised" rather than "silently invisible".
 */
export const TEXT_TYPES = new Set(['RCTText', 'RCTVirtualText', 'Text']);

export const SCROLL_TYPES = new Set([
  'RCTScrollView',
  'AndroidHorizontalScrollView',
  'ScrollView',
]);

export const TEXT_INPUT_TYPES = new Set([
  'AndroidTextInput',
  'RCTSinglelineTextInputView',
  'RCTMultilineTextInputView',
  'TextInput',
]);

export const isTextFiber = (fiber: Fiber): boolean =>
  isHost(fiber) && TEXT_TYPES.has(hostType(fiber));

export const isScrollFiber = (fiber: Fiber): boolean =>
  isHost(fiber) && SCROLL_TYPES.has(hostType(fiber));

export const isTextInputFiber = (fiber: Fiber): boolean =>
  isHost(fiber) && TEXT_INPUT_TYPES.has(hostType(fiber));

/** Inserted where inline non-text content sits, to keep indices aligned. */
export const OBJECT_REPLACEMENT = '\uFFFC';

const isPrivateUse = (codePoint: number): boolean =>
  (codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
  (codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
  (codePoint >= 0x100000 && codePoint <= 0x10fffd);

/**
 * Whether a string is worth translating.
 *
 * Icon fonts draw a glyph from a private-use-area codepoint, and UI frameworks
 * routinely render icons as text nodes. Without this filter, tapping an icon
 * would send a meaningless glyph to the translation API — and, since a
 * control's label is what makes it translatable, would also stop icon buttons
 * from ever being pressed.
 *
 * This **must** be an exclusion test, not an "is this a letter" test. Arabic is
 * a supported language and its script is uncased, so any heuristic built on
 * letter case quietly rejects it.
 */
export const isTranslatable = (text: string): boolean => {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;

    // Whitespace: space, tab, CR, LF.
    if (
      codePoint === 0x20 ||
      codePoint === 0x09 ||
      codePoint === 0x0a ||
      codePoint === 0x0d
    ) {
      continue;
    }
    // Our own alignment placeholder is not content.
    if (codePoint === 0xfffc) continue;
    if (isPrivateUse(codePoint)) continue;

    return true;
  }
  return false;
};

/**
 * The rendered string of a text fiber.
 *
 * Reads only rendered children — never `accessibilityLabel`, which would
 * substitute different text from what is on screen — and inserts a placeholder
 * for inline embedded content, because dropping it would shift every character
 * index after it and silently misalign the tap-position-to-character mapping.
 */
export const readText = (fiber: Fiber): string => {
  let out = '';

  const visit = (node: Fiber | null): void => {
    for (let current = node; current; current = current.sibling ?? null) {
      if (isHostText(current)) {
        out += String(current.memoizedProps);
        continue;
      }
      if (isHost(current) && !TEXT_TYPES.has(hostType(current))) {
        // An inline view, image or other embedded content.
        out += OBJECT_REPLACEMENT;
        continue;
      }
      visit(current.child ?? null);
    }
  };

  visit(fiber.child ?? null);
  return out;
};

/** The text of a `TextInput`, which carries it as a prop rather than children. */
export const readTextInputValue = (fiber: Fiber): string => {
  const props = fiber.memoizedProps as
    | { value?: unknown; defaultValue?: unknown }
    | null
    | undefined;

  if (typeof props?.value === 'string') return props.value;
  if (typeof props?.defaultValue === 'string') return props.defaultValue;
  return readText(fiber);
};

/** The deepest translatable text inside `fiber`, used by legacy capture mode. */
export const deepestTextIn = (fiber: Fiber): Fiber | null => {
  for (const node of subtree(fiber.child ?? null)) {
    if (isTextFiber(node) && isTranslatable(readText(node))) return node;
  }
  return null;
};
