/**
 * Whether the patched `Text` should be recording line geometry right now.
 *
 * A tiny external store rather than context: the patched `Text` sits in the
 * host's tree, which is not inside any provider the SDK controls, and it must
 * not force the host app to re-render for anything but this flag.
 */

type Listener = () => void;

let enabled = false;
const listeners = new Set<Listener>();

export const isTapModeOn = (): boolean => enabled;

export const setTapModeOn = (next: boolean): void => {
  if (enabled === next) return;
  enabled = next;
  for (const listener of [...listeners]) listener();
};

export const subscribeToTapMode = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
