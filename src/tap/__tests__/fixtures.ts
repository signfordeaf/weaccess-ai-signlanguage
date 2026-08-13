/**
 * Hand-built fiber fixtures.
 *
 * `classify`, `readText` and `isTranslatable` are pure functions over plain
 * data, so most of the tap-classification suite needs no renderer at all — just trees
 * shaped like the ones React builds.
 */

import type { Fiber } from '../fiber';

type Node = Fiber & { child?: Fiber | null; sibling?: Fiber | null };

/** Link children to a parent, returning the parent. */
const link = (parent: Node, children: Node[]): Node => {
  parent.child = children[0] ?? null;
  children.forEach((child, index) => {
    child.return = parent;
    child.sibling = children[index + 1] ?? null;
  });
  return parent;
};

/** A host node — one that maps to a real view. */
export const host = (
  type: string,
  props: Record<string, unknown> = {},
  ...children: Node[]
): Node => link({ type, memoizedProps: props }, children);

/** A text node: its props *are* the string. */
export const txt = (value: string): Node => ({
  type: null,
  memoizedProps: value,
});

/** A composite (function/class) node. */
export const composite = (
  name: string,
  props: Record<string, unknown> = {},
  ...children: Node[]
): Node =>
  link({ type: { displayName: name }, memoizedProps: props }, children);

/** The deepest descendant, which is what a touch would target. */
export const deepest = (node: Node): Node => {
  let current: Node = node;
  while (current.child) current = current.child as Node;
  return current;
};

/**
 * A `Pressable`, as React actually builds it: a composite wrapping a host View
 * that carries the responder props.
 */
export const pressable = (...children: Node[]): Node =>
  composite(
    'Pressable',
    {},
    host(
      'RCTView',
      { onStartShouldSetResponder: () => true, onResponderGrant: () => {} },
      ...children
    )
  );

/** A `Text` with a string inside it. */
export const text = (
  value: string,
  props: Record<string, unknown> = {}
): Node => host('RCTText', props, txt(value));
