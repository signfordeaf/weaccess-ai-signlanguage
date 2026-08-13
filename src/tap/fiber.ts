/**
 * Reading React's fiber tree from a responder event.
 *
 * The SDK must classify a touch *during hit testing* and decline
 * to be in the hit path when the tap does not belong to it. In React Native
 * that means answering `onStartShouldSetResponderCapture`, and to answer it the
 * SDK needs to know what is under the finger.
 *
 * The fiber tree is the right thing to probe — better than the native view
 * tree, because it carries `onPress`, `onLongPress`, `editable` and `selectable`
 * (the exact predicates the walk rules are written in terms of) and it
 * survives Fabric's view flattening, which the native tree does not.
 *
 * `_targetInst` is a React internal. It is present in every renderer bundle
 * across the supported range, but this module treats it as what it is: when it
 * cannot be read, `getTargetFiber` returns `null` and the surface **fails
 * open** — claiming nothing, leaving every tap to the host.
 */

/** The subset of a fiber node this SDK reads. */
export interface Fiber {
  /** A string for host nodes, a component for composites, `null` for text. */
  type: unknown;
  memoizedProps: unknown;
  stateNode?: unknown;
  return?: Fiber | null;
  child?: Fiber | null;
  sibling?: Fiber | null;
}

/**
 * A host node — one that maps to a real view.
 *
 * Detected structurally rather than by numeric tag: `type` is the view-config
 * name string on both renderers.
 */
export const isHost = (fiber: Fiber): boolean => typeof fiber.type === 'string';

/** A text node: its props *are* the string. */
export const isHostText = (fiber: Fiber): boolean =>
  typeof fiber.memoizedProps === 'string' ||
  typeof fiber.memoizedProps === 'number';

export const hostType = (fiber: Fiber): string =>
  typeof fiber.type === 'string' ? fiber.type : '';

/** The display name of a composite fiber, for recognising known wrappers. */
export const compositeName = (fiber: Fiber): string => {
  const type = fiber.type as
    | { displayName?: string; name?: string }
    | null
    | undefined;
  if (!type || typeof type === 'string') return '';
  return type.displayName ?? type.name ?? '';
};

/**
 * The deepest fiber under the touch.
 *
 * On a touch start with no current responder, React sets the target instance to
 * the hit node itself, so this really is the deepest node rather than a common
 * ancestor.
 */
export const getTargetFiber = (event: unknown): Fiber | null => {
  const candidate = event as {
    _targetInst?: unknown;
    target?: { __internalInstanceHandle?: unknown };
  } | null;

  const inst = candidate?._targetInst;
  if (inst && typeof inst === 'object') return inst as Fiber;

  // Fabric exposes the fiber through the public element wrapper. On the old
  // architecture `target` is a bare number and there is no second path.
  const handle = candidate?.target?.__internalInstanceHandle;
  if (handle && typeof handle === 'object') return handle as Fiber;

  return null;
};

/** Walk from `fiber` outward through its ancestors, inclusive. */
export function* ancestors(fiber: Fiber | null): Generator<Fiber> {
  // A malformed tree must not spin forever.
  let guard = 0;
  for (let node = fiber; node && guard < 1000; node = node.return ?? null) {
    guard++;
    yield node;
  }
}

/** Walk a fiber's subtree depth-first, in render order. */
export function* subtree(fiber: Fiber | null): Generator<Fiber> {
  let guard = 0;
  const stack: Fiber[] = [];
  for (let node = fiber; node; node = node.sibling ?? null) stack.push(node);
  stack.reverse();

  while (stack.length && guard < 5000) {
    guard++;
    const node = stack.pop()!;
    yield node;

    const children: Fiber[] = [];
    for (let child = node.child ?? null; child; child = child.sibling ?? null) {
      children.push(child);
    }
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!);
  }
}
