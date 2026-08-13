/**
 * Long press to translate.
 *
 * This reaches the one thing passthrough cannot: **text the host app made
 * tappable**, where a tap always belongs to the app and so can never be
 * translated.
 *
 * It rides on the touch events (`onTouchStartCapture` / `onTouchMove` /
 * `onTouchEnd`), which React Native dispatches two-phase and *independently of
 * the responder system*. The SDK therefore observes the whole gesture without
 * ever claiming it — it genuinely does not block the gesture, and
 * stronger than joining the competition would be, since a gesture never asked
 * for cannot be stolen.
 *
 * "Yields to a long press the host built" is implemented as a deterministic
 * check rather than a 600-vs-500 ms race: if any non-ambient fiber in the path
 * declares `onLongPress` or `delayLongPress`, the timer is simply never armed.
 */

import { ancestors, compositeName, isHost, type Fiber } from './fiber';
import {
  isScrollFiber,
  isTextFiber,
  isTextInputFiber,
  isTranslatable,
  readText,
} from './textNode';

/**
 * Deliberately longer than the framework default of 500 ms.
 *
 * This layer sits above the host app and would win a tie, so any long press the
 * host built must fire first and take the gesture.
 */
export const LONG_PRESS_MS = 600;

export interface LongPressTarget {
  fiber: Fiber;
  text: string;
}

const GESTURE_COMPOSITES = /GestureDetector|BaseButton|RawButton/;

/**
 * Find the text a long press at `target` should translate, or `null` if this
 * gesture is not the SDK's to take.
 *
 * The interactivity check is deliberately *skipped* — tappable text is exactly
 * what this path is for — but the SDK stays out of editable and selectable text
 * entirely, rather than joining the competition and withdrawing later. Winning
 * and then withdrawing cancels the user's selection, and the selection toolbar
 * is what long press means there.
 */
export const findLongPressTarget = (
  target: Fiber,
  isAmbient: (fiber: Fiber) => boolean = () => false
): LongPressTarget | null => {
  let text: Fiber | null = null;

  for (const fiber of ancestors(target)) {
    const props = fiber.memoizedProps as Record<string, unknown> | null;

    // Over editable text the SDK must not participate at all.
    if (isTextInputFiber(fiber) && props?.editable !== false) return null;
    // A selectable Text already means "the selection toolbar".
    if (isTextFiber(fiber) && props?.selectable === true) return null;

    // Yield to a long press the host built.
    const hostLongPress =
      props?.onLongPress != null || props?.delayLongPress != null;
    const gestureComposite =
      !isHost(fiber) && GESTURE_COMPOSITES.test(compositeName(fiber));
    if ((hostLongPress || gestureComposite) && !isAmbient(fiber)) return null;

    if (!text && isTextFiber(fiber)) text = fiber;

    // A scroll view bounds the walk, as it does for a tap.
    if (isScrollFiber(fiber)) break;
  }

  if (!text) return null;

  const body = readText(text);
  return isTranslatable(body) ? { fiber: text, text: body } : null;
};
