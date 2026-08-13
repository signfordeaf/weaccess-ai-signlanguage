/**
 * Classifying a touch.
 *
 * Walks the fiber tree outward from the node under the finger and produces one
 * of three outcomes:
 *
 * | Outcome       | Meaning                                          | Behavior      |
 * | ------------- | ------------------------------------------------ | ------------- |
 * | `text`        | Plain text, **including the label of a control**  | SDK claims it |
 * | `interactive` | A control with no text of its own, or an editable | Host gets it  |
 * | `none`        | Empty space, an image, a decoration               | Host gets it  |
 *
 * ## Why a control's label is translatable
 *
 * A Deaf user could otherwise translate a contract but not the button that
 * agrees to it — the one word that matters most. So a control *with* a text
 * label has its label translated, and a control *without* one (icon button,
 * switch, the box of a checkbox) passes through. The same checkbox row
 * therefore reads when tapped on its label and ticks when tapped on its box.
 */

import { ancestors, compositeName, isHost, type Fiber } from './fiber';
import {
  isScrollFiber,
  isTextFiber,
  isTextInputFiber,
  isTranslatable,
  readText,
  readTextInputValue,
} from './textNode';

export type TapOutcomeKind = 'text' | 'interactive' | 'none';

export interface TapOutcome {
  kind: TapOutcomeKind;
  /** The text fiber that won, on a `text` outcome. */
  fiber?: Fiber;
  /** Its rendered string. */
  text?: string;
}

const TEXT_NONE: TapOutcome = { kind: 'none' };
const TEXT_INTERACTIVE: TapOutcome = { kind: 'interactive' };

export interface ProbeContext {
  /** The area the SDK covers, for the ambient-listener test. */
  area?: { width: number; height: number };
  /** Whether the software keyboard is up. */
  keyboardVisible?: boolean;
  /**
   * Whether a fiber covers so much of the probed area that it is scenery
   * rather than a control. Supplied by `measure.ts`.
   */
  isAmbient?: (fiber: Fiber, context: ProbeContext) => boolean;
}

/** Gesture wrappers that own a touch without being host views. */
const GESTURE_COMPOSITES =
  /GestureDetector|BaseButton|RawButton|TouchableNativeFeedback/;

const isGestureComposite = (fiber: Fiber): boolean =>
  !isHost(fiber) && GESTURE_COMPOSITES.test(compositeName(fiber));

/** Whether a host fiber carries touch handling of its own. */
const hasResponderProps = (props: unknown): boolean => {
  const p = props as Record<string, unknown> | null | undefined;
  if (!p) return false;
  return (
    p.onStartShouldSetResponder != null ||
    p.onResponderGrant != null ||
    p.onClick != null
  );
};

/** A `Text` the host made tappable is a control, not prose. */
const isPressableText = (props: unknown): boolean => {
  const p = props as Record<string, unknown> | null | undefined;
  if (!p) return false;
  return p.isPressable === true || p.onStartShouldSetResponder != null;
};

const persistsTaps = (props: unknown): boolean => {
  const value = (props as { keyboardShouldPersistTaps?: unknown })
    ?.keyboardShouldPersistTaps;
  return value === 'always' || value === 'handled';
};

const asText = (fiber: Fiber, text: string): TapOutcome => ({
  kind: 'text',
  fiber,
  text,
});

/**
 * Classify the touch whose deepest node is `target`.
 *
 * Rules are applied in order while walking outward.
 */
export const classify = (
  target: Fiber,
  context: ProbeContext = {}
): TapOutcome => {
  const ambient = (fiber: Fiber) =>
    context.isAmbient ? context.isAmbient(fiber, context) : false;

  let candidate: TapOutcome | null = null;

  for (const fiber of ancestors(target)) {
    const props = fiber.memoizedProps;

    if (!isHost(fiber)) {
      // Rule 3 also fires for gesture-handler wrappers and similar composites.
      if (isGestureComposite(fiber) && !ambient(fiber)) {
        return candidate ?? TEXT_INTERACTIVE;
      }
      continue;
    }

    // Rule 1 — stop at the innermost scrollable.
    //
    // A scroll view's own pointer listeners are *ancestors* of its content, so
    // without this guard every tap inside any list would read as interactive
    // and nothing would ever be translatable.
    if (isScrollFiber(fiber)) {
      // The one carve-out: a tap meant to dismiss the keyboard is not ours.
      if (context.keyboardVisible && !persistsTaps(props)) {
        return TEXT_INTERACTIVE;
      }
      break;
    }

    // Rule 2 — an editable field keeps its focus and caret. A read-only
    // selectable field carries no editing affordance and stays translatable.
    if (isTextInputFiber(fiber)) {
      const editable = (props as { editable?: unknown })?.editable;
      if (editable === false) {
        const value = readTextInputValue(fiber);
        return isTranslatable(value) ? asText(fiber, value) : TEXT_NONE;
      }
      return TEXT_INTERACTIVE;
    }

    if (isTextFiber(fiber)) {
      // Rule 3 before rule 4 at the same node: text the host made tappable is
      // interactive, which is precisely the case long press exists for.
      if (isPressableText(props) && !ambient(fiber)) {
        return candidate ?? TEXT_INTERACTIVE;
      }

      // Rule 4 — remember it as the candidate, subject to the
      // translatable-content test.
      if (!candidate) {
        const text = readText(fiber);
        if (isTranslatable(text)) candidate = asText(fiber, text);
      }
      continue;
    }

    // Rule 3 — a plain pointer listener on a host view: the inner View of a
    // Pressable or Touchable. If text was already found deeper, that text wins.
    if (hasResponderProps(props) && !ambient(fiber)) {
      return candidate ?? TEXT_INTERACTIVE;
    }
  }

  // Rule 5 — nothing found.
  return candidate ?? TEXT_NONE;
};

/**
 * Legacy capture mode (`smartPassthrough: false`).
 *
 * Restores v1: claim every tap and return the deepest text under the point,
 * regardless of interactivity. It exists as an escape hatch for host apps whose
 * custom gesture handling confuses the probe.
 */
export const classifyLegacy = (target: Fiber): TapOutcome => {
  for (const fiber of ancestors(target)) {
    if (isTextFiber(fiber)) {
      const text = readText(fiber);
      if (isTranslatable(text)) return asText(fiber, text);
    }
    if (isTextInputFiber(fiber)) {
      const value = readTextInputValue(fiber);
      if (isTranslatable(value)) return asText(fiber, value);
    }
  }
  return TEXT_NONE;
};
