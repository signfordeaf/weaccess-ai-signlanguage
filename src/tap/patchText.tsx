/**
 * Supplying line geometry to the probe.
 *
 * The probe needs `onTextLayout`'s per-line rects to map a touch position to a
 * character offset. Rather than keep a registry of every `Text` on screen, the
 * SDK replaces React Native's public `Text` export with one that stashes its
 * own lines on the handler function — which the fiber walk then reads straight
 * off `memoizedProps`. That is O(1), leaks nothing (the record lives exactly as
 * long as the fiber), and needs no tags or `findNodeHandle`.
 *
 * ## Why not `Text.render`
 *
 * `SelectableTextProvider` patches `Text.render` today. That stopped working at
 * React Native 0.81, where `Text` became a plain function component and
 * `Text.render` is `undefined` — including on the 0.83 that `TestApp` runs. The
 * guard there means it fails silently rather than loudly, which is worse.
 *
 * Replacing the namespace export instead touches nothing internal: no
 * `forwardRef.render`, no `defaultProps`, no renderer internals. React 19 and
 * Fabric are unaffected.
 *
 * ## This is an enhancement, never a dependency
 *
 * If the patch cannot install, classification, passthrough, the PUA filter and
 * long press all still work; only sentence *precision* degrades to the
 * whole-paragraph fallback, which is a sanctioned outcome.
 */

import React from 'react';
import type { TextProps } from 'react-native';
import type { TextLayoutLine } from './charOffset';
import { isTapModeOn, subscribeToTapMode } from './textLayoutStore';

/** What the patched handler carries, and what the probe looks for. */
export interface LineRecord {
  current: { lines: TextLayoutLine[] | null };
}

const RECORD_KEY = '__signLanguageLines';

export type PatchResult = 'patched' | 'already' | 'unavailable';

/** Read the lines a patched `Text` recorded, if there are any. */
export const linesFromProps = (props: unknown): TextLayoutLine[] | null => {
  const handler = (props as { onTextLayout?: unknown })?.onTextLayout as
    | (Function & { [RECORD_KEY]?: LineRecord })
    | undefined;
  return handler?.[RECORD_KEY]?.current.lines ?? null;
};

const makePatched = (Original: React.ComponentType<TextProps>) => {
  const Patched = React.forwardRef<unknown, TextProps>(function Text(
    props,
    ref
  ) {
    const record = React.useRef<{ lines: TextLayoutLine[] | null }>({
      lines: null,
    });

    // Gated, so a screen with hundreds of Texts does not pay a per-layout
    // bridge event in the steady state. Attaching only while the player is
    // open costs one re-render pass at the toggle; layout does not change.
    const wanted = React.useSyncExternalStore(
      subscribeToTapMode,
      isTapModeOn,
      isTapModeOn
    );

    const hostHandler = props.onTextLayout;

    const onTextLayout = React.useMemo(() => {
      if (!wanted) return hostHandler;

      const handler = (
        event: Parameters<NonNullable<TextProps['onTextLayout']>>[0]
      ) => {
        record.current.lines = event.nativeEvent
          .lines as unknown as TextLayoutLine[];
        // Anything the host set still runs.
        hostHandler?.(event);
      };
      (handler as Function & { [RECORD_KEY]?: LineRecord })[RECORD_KEY] =
        record;
      return handler;
    }, [wanted, hostHandler]);

    // `Original` is typed as a plain component but is always ref-forwarding
    // here; RN's own `Text` has accepted a ref since long before the range this
    // SDK supports.
    const Renderable = Original as React.ComponentType<
      TextProps & { ref?: unknown }
    >;
    return <Renderable {...props} onTextLayout={onTextLayout} ref={ref} />;
  });

  // Keep the identity a host's existing snapshots were taken against.
  Patched.displayName =
    (Original as { displayName?: string }).displayName ?? 'Text';
  (Patched as { __signLanguagePatched?: boolean }).__signLanguagePatched = true;

  return Patched;
};

let original: React.ComponentType<TextProps> | null = null;

/**
 * Replace `react-native`'s `Text` export.
 *
 * Idempotent, and reversible via {@link unpatchGlobalText}. Returns what
 * happened so the caller can warn once in development rather than assume.
 */
export const patchGlobalText = (): PatchResult => {
  const RN = require('react-native') as Record<string, unknown>;

  const descriptor = Object.getOwnPropertyDescriptor(RN, 'Text');
  if (!descriptor || descriptor.configurable !== true) return 'unavailable';

  const current = RN.Text as
    | (React.ComponentType<TextProps> & { __signLanguagePatched?: boolean })
    | undefined;
  if (!current) return 'unavailable';
  if (current.__signLanguagePatched) return 'already';

  original = current;
  const Patched = makePatched(current);

  Object.defineProperty(RN, 'Text', {
    configurable: true,
    enumerable: true,
    get: () => Patched,
  });

  return 'patched';
};

export const unpatchGlobalText = (): void => {
  if (!original) return;

  const RN = require('react-native') as Record<string, unknown>;
  const restored = original;
  original = null;

  Object.defineProperty(RN, 'Text', {
    configurable: true,
    enumerable: true,
    get: () => restored,
  });
};
