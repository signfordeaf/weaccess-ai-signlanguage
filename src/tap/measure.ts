/**
 * The ambient-listener test.
 *
 * Host apps commonly wrap a whole page in a tap handler that just dismisses the
 * keyboard. Without a guard that single widget marks every tap on the page as
 * interactive and translation never triggers. So a pointer listener
 * covering **>= 80%** of the probed area as ambient and skips it.
 *
 * The measurement is exact on the new architecture, where `getBoundingClientRect`
 * is synchronous. The old architecture has no synchronous measure at all, so
 * this keeps a cache and answers "not ambient" on a miss, scheduling the
 * measurement for next time. That failure mode is deliberately the safe one: it
 * **declines**, handing the tap to the host, and never wrongly claims. The very
 * first tap on such a page dismisses the keyboard — usually what the user
 * wanted — and every tap after it classifies correctly.
 */

import { Keyboard } from 'react-native';
import type { Fiber } from './fiber';
import type { ProbeContext } from './probe';

/** A listener covering this much of the probed area is scenery, not a control. */
export const AMBIENT_AREA_FRACTION = 0.8;

interface Rect {
  width: number;
  height: number;
}

/**
 * Measurements keyed by native tag, for the old architecture.
 *
 * Bounded so a long-lived app cannot accumulate one entry per view it has ever
 * touched.
 */
export class MeasureCache {
  private rects = new Map<number, Rect>();
  private pending = new Set<number>();

  constructor(private readonly capacity = 64) {}

  get(tag: number): Rect | undefined {
    return this.rects.get(tag);
  }

  schedule(tag: number, node: unknown): void {
    if (this.pending.has(tag) || this.rects.has(tag)) return;

    const measurable = node as {
      measureInWindow?: (
        callback: (x: number, y: number, width: number, height: number) => void
      ) => void;
    };
    if (typeof measurable?.measureInWindow !== 'function') return;

    this.pending.add(tag);
    try {
      measurable.measureInWindow((_x, _y, width, height) => {
        this.pending.delete(tag);
        if (!(width > 0 && height > 0)) return;

        if (this.rects.size >= this.capacity) {
          const oldest = this.rects.keys().next();
          if (!oldest.done) this.rects.delete(oldest.value);
        }
        this.rects.set(tag, { width, height });
      });
    } catch {
      this.pending.delete(tag);
    }
  }

  clear(): void {
    this.rects.clear();
    this.pending.clear();
  }
}

const coversMost = (rect: Rect, area: Rect): boolean =>
  rect.width * rect.height >= AMBIENT_AREA_FRACTION * area.width * area.height;

/**
 * Build the ambient test for a given measure cache.
 *
 * Returned as a factory rather than a bare function so the surface owns the
 * cache's lifetime.
 */
export const makeIsAmbient =
  (cache: MeasureCache) =>
  (fiber: Fiber, context: ProbeContext): boolean => {
    const area = context.area;
    if (!area || !(area.width > 0) || !(area.height > 0)) return false;

    // The canonical case, recognised by function identity — free, and exact.
    const onPress = (fiber.memoizedProps as { onPress?: unknown })?.onPress;
    if (onPress === Keyboard.dismiss) return true;

    const node = fiber.stateNode as
      | {
          getBoundingClientRect?: () => { width: number; height: number };
          _nativeTag?: number;
        }
      | null
      | undefined;
    if (!node) return false;

    // New architecture: synchronous and exact.
    if (typeof node.getBoundingClientRect === 'function') {
      try {
        const rect = node.getBoundingClientRect();
        return coversMost(rect, area);
      } catch {
        return false;
      }
    }

    // Old architecture: answer from the cache, or schedule and decline.
    const tag = node._nativeTag;
    if (typeof tag !== 'number') return false;

    const hit = cache.get(tag);
    if (hit) return coversMost(hit, area);

    cache.schedule(tag, node);
    return false;
  };
