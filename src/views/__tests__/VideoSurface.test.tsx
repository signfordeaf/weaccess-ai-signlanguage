import React from 'react';
import { Image } from 'react-native';
import { render } from '@testing-library/react-native';

import { VideoSurface, resolveVideoUri } from '../VideoSurface';

/**
 * The video surface is the SDK's only contact with a decoder, and the contract
 * it has to hold is narrow: whatever the caller passes as a source, native
 * receives a plain URI string.
 */
describe('resolveVideoUri', () => {
  it('passes a remote URL through untouched', () => {
    expect(resolveVideoUri('https://cdn.test/v/a.mp4')).toBe(
      'https://cdn.test/v/a.mp4'
    );
  });

  it('resolves a bundled asset through the asset registry', () => {
    // `require` of an mp4 is opaque, and only the registry knows whether it
    // means a dev-server URL or a bundled path. What matters here is that the
    // registry is what we ask — Jest's asset transformer cannot produce a real
    // entry, so the resolver is stubbed rather than the pipeline exercised.
    const asset = require('../../assets/videos/placeholder-kadir.mp4');
    const spy = jest
      .spyOn(Image, 'resolveAssetSource')
      .mockReturnValue({ uri: 'file:///app/placeholder-kadir.mp4' } as never);

    expect(resolveVideoUri(asset)).toBe('file:///app/placeholder-kadir.mp4');
    expect(spy).toHaveBeenCalledWith(asset);

    spy.mockRestore();
  });

  it('yields an empty string rather than throwing on an unresolvable source', () => {
    jest
      .spyOn(Image, 'resolveAssetSource')
      .mockReturnValueOnce(undefined as never);
    expect(resolveVideoUri(1234 as never)).toBe('');
    jest.restoreAllMocks();
  });
});

describe('VideoSurface', () => {
  const props = {
    source: 'https://cdn.test/v/a.mp4',
    paused: true,
    repeat: true,
    muted: true,
    rate: 1.5,
    resizeMode: 'cover' as const,
  };

  it('hands native a URI string and the playback props', () => {
    const { UNSAFE_getByType } = render(<VideoSurface {...props} />);
    // The RN jest preset mocks `requireNativeComponent` into a host component,
    // so the props actually sent to native are assertable.
    const native = UNSAFE_getByType('SignVideoView' as never);

    expect(native.props).toMatchObject({
      uri: 'https://cdn.test/v/a.mp4',
      paused: true,
      // `repeat` is a reserved word in Swift, so the native prop is `repeats`.
      repeats: true,
      muted: true,
      rate: 1.5,
      resizeMode: 'cover',
    });
  });

  it('reports the aspect ratio from the native load event', () => {
    const onAspectRatio = jest.fn();
    const { UNSAFE_getByType } = render(
      <VideoSurface {...props} onAspectRatio={onAspectRatio} />
    );

    UNSAFE_getByType('SignVideoView' as never).props.onSignVideoLoad({
      nativeEvent: { width: 900, height: 828 },
    });

    expect(onAspectRatio).toHaveBeenCalledWith(900 / 828);
  });

  it('ignores a load event with no usable size', () => {
    const onAspectRatio = jest.fn();
    const { UNSAFE_getByType } = render(
      <VideoSurface {...props} onAspectRatio={onAspectRatio} />
    );

    UNSAFE_getByType('SignVideoView' as never).props.onSignVideoLoad({
      nativeEvent: { width: 0, height: 0 },
    });

    expect(onAspectRatio).not.toHaveBeenCalled();
  });

  it('forwards end and error', () => {
    const onEnd = jest.fn();
    const onError = jest.fn();
    const { UNSAFE_getByType } = render(
      <VideoSurface {...props} onEnd={onEnd} onError={onError} />
    );
    const native = UNSAFE_getByType('SignVideoView' as never);

    native.props.onSignVideoEnd({ nativeEvent: {} });
    native.props.onSignVideoError({ nativeEvent: { message: 'boom' } });

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ message: 'boom' });
  });
});
