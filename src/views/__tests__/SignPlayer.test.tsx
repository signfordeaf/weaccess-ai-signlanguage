import React from 'react';
import { Dimensions } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { SignPlayer } from '../SignPlayer';
import { SignController } from '../../controller/controller';
import { resetConfig } from '../../core/config';
import { SPACE } from '../../core/tokens';

/**
 * The player floats over the host app, so the one thing it must never do is
 * park itself where the user cannot reach it. Its size is *predicted* by the
 * layout math and only afterwards *measured* by the platform, and the two can
 * disagree — a wider control bar, a caption that wraps differently, a first
 * frame laid out before the window reported its final size. When they disagree,
 * the measurement wins: the position is re-clamped against the frame that
 * actually exists.
 */

const SCREEN = { width: 402, height: 874, scale: 3, fontScale: 1 };

const makeController = () => {
  const controller = new SignController();
  controller.configure({
    apiKey: 'RK',
    apiUrl: 'https://api.test',
    language: 'tr',
  });
  controller.enable();
  // Opening it is what makes `playerVisible` true without a translation.
  controller.toggleTapMode();
  return controller;
};

/** Animated styles hold value nodes, not numbers, until they are read. */
const valueOf = (candidate: unknown): number =>
  typeof candidate === 'number'
    ? candidate
    : (candidate as { __getValue: () => number }).__getValue();

/** The animated container is the only view carrying a transform. */
const transformOf = (tree: ReturnType<typeof render>) => {
  const container = tree.UNSAFE_root.findAll((node: { props?: any }) =>
    ([] as any[])
      .concat(node.props?.style ?? [])
      .some((entry) => entry?.transform)
  )[0];
  expect(container).toBeTruthy();

  const style = ([] as any[]).concat(container.props.style).filter(Boolean);
  const { transform } = style.find((entry) => entry?.transform);
  const translateX = transform.find((t: object) => 'translateX' in t);
  const translateY = transform.find((t: object) => 'translateY' in t);
  return {
    x: valueOf(translateX.translateX),
    y: valueOf(translateY.translateY),
  };
};

const layoutEvent = (width: number, height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height } },
});

let controller: SignController;
let dimensionsSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  resetConfig();
  dimensionsSpy = jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue(SCREEN as never);
  controller = makeController();
});

afterEach(() => {
  // Let the entrance animation finish inside act(), or its last frame lands
  // after the test and React complains about an unwrapped update.
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  dimensionsSpy.mockRestore();
  controller.dispose();
  resetConfig();
});

describe('SignPlayer position', () => {
  it('opens inside the screen', () => {
    const tree = render(<SignPlayer controller={controller} />);
    const { x, y } = transformOf(tree);

    expect(x).toBeGreaterThanOrEqual(SPACE.md);
    expect(y).toBeGreaterThanOrEqual(SPACE.md);
    expect(x).toBeLessThanOrEqual(SCREEN.width);
  });

  it('pulls itself back when it measures wider than predicted', () => {
    const tree = render(<SignPlayer controller={controller} />);
    const before = transformOf(tree);

    // The real card comes out much wider than the layout math assumed: with the
    // prediction alone, this width would hang off the right edge.
    const measuredWidth = 360;
    const container = tree.UNSAFE_root.findAll(
      (node: { props?: any }) => typeof node.props?.onLayout === 'function'
    )[0];

    act(() => {
      container.props.onLayout(layoutEvent(measuredWidth, 300));
    });

    const after = transformOf(tree);

    expect(before.x + measuredWidth).toBeGreaterThan(SCREEN.width);
    expect(after.x + measuredWidth).toBeLessThanOrEqual(SCREEN.width);
    expect(after.x).toBe(SCREEN.width - measuredWidth - SPACE.md);
  });

  it('pulls itself up when it measures taller than predicted', () => {
    const tree = render(<SignPlayer controller={controller} />);

    const container = tree.UNSAFE_root.findAll(
      (node: { props?: any }) => typeof node.props?.onLayout === 'function'
    )[0];

    act(() => {
      container.props.onLayout(layoutEvent(212, 800));
    });

    const { y } = transformOf(tree);
    expect(y + 800).toBeLessThanOrEqual(SCREEN.height);
  });
});
