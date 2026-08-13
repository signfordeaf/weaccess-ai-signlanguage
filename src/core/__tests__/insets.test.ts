import { Platform, StatusBar } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';

import { estimateInsets, useSafeAreaInsets } from '../insets';

/**
 * The insets decide where the player and the button are allowed to sit, so
 * getting them wrong is what puts a control under the notch or the gesture bar.
 * The platform is the authority; the estimate only has to be sane, and has to
 * survive a native module that is old, absent, or answers with nonsense.
 */

// `mock` prefix: Jest allows only these to cross into a module factory.
const mockGetSafeAreaInsets = jest.fn();

jest.mock('../../NativeSignLanguage', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setEnabled: jest.fn(),
    enableTextSelectionForView: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    getSafeAreaInsets: (...args: unknown[]) => mockGetSafeAreaInsets(...args),
  },
}));

const originalOS = Platform.OS;

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS });
  mockGetSafeAreaInsets.mockReset();
});

const setOS = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os });

describe('estimateInsets', () => {
  it('reserves the gesture bar on Android, not zero', () => {
    setOS('android');
    StatusBar.currentHeight = 24;

    const insets = estimateInsets(393, 873);

    expect(insets.top).toBe(24);
    // An edge-to-edge window puts the navigation bar over the app's layout;
    // a surface flush with the bottom would land under it.
    expect(insets.bottom).toBeGreaterThan(0);
  });

  it('uses the notch values only for devices shaped like one', () => {
    setOS('ios');

    expect(estimateInsets(402, 874)).toMatchObject({ top: 47, bottom: 34 });
    expect(estimateInsets(320, 568)).toMatchObject({ top: 20, bottom: 0 });
  });
});

describe('useSafeAreaInsets', () => {
  it('settles on the platform’s own numbers', async () => {
    setOS('ios');
    mockGetSafeAreaInsets.mockResolvedValue({
      top: 59,
      bottom: 34,
      left: 0,
      right: 0,
    });

    const { result } = renderHook(() => useSafeAreaInsets(402, 874));
    expect(result.current.top).toBe(47); // the estimate, first frame

    await waitFor(() => expect(result.current.top).toBe(59));
    expect(result.current.bottom).toBe(34);
  });

  it('keeps the estimate when the native module rejects', async () => {
    setOS('ios');
    mockGetSafeAreaInsets.mockRejectedValue(new Error('no such method'));

    const { result } = renderHook(() => useSafeAreaInsets(402, 874));

    await waitFor(() => expect(mockGetSafeAreaInsets).toHaveBeenCalled());
    expect(result.current).toMatchObject({ top: 47, bottom: 34 });
  });

  it('rejects a nonsense payload rather than laying out against it', async () => {
    setOS('ios');
    mockGetSafeAreaInsets.mockResolvedValue({ top: -10, bottom: NaN });

    const { result } = renderHook(() => useSafeAreaInsets(402, 874));

    await waitFor(() => expect(mockGetSafeAreaInsets).toHaveBeenCalled());
    expect(result.current).toMatchObject({ top: 47, bottom: 34 });
  });

  it('re-asks when the window changes size', async () => {
    setOS('android');
    mockGetSafeAreaInsets.mockResolvedValue({
      top: 24,
      bottom: 48,
      left: 0,
      right: 0,
    });

    const { rerender } = renderHook(
      ({ width, height }: { width: number; height: number }) =>
        useSafeAreaInsets(width, height),
      { initialProps: { width: 393, height: 873 } }
    );

    await waitFor(() => expect(mockGetSafeAreaInsets).toHaveBeenCalledTimes(1));

    // Rotation: the bars move to a different edge, so the answer changes too.
    rerender({ width: 873, height: 393 });

    await waitFor(() => expect(mockGetSafeAreaInsets).toHaveBeenCalledTimes(2));
  });
});
