import { SignEventEmitter, legacyAliasFor, signError } from '../events';

describe('SignEventEmitter', () => {
  it('delivers to listeners of the v2 name', () => {
    const emitter = new SignEventEmitter();
    const listener = jest.fn();
    emitter.on('translationComplete', listener);

    emitter.emit('translationComplete', {
      text: 'Merhaba',
      videoUrl: 'u',
      cid: '7',
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      type: 'translationComplete',
      text: 'Merhaba',
      videoUrl: 'u',
      cid: '7',
    });
    expect(typeof listener.mock.calls[0][0].timestamp).toBe('number');
  });

  it('delivers the same event under its v1 alias', () => {
    const emitter = new SignEventEmitter();
    const v1 = jest.fn();
    const v2 = jest.fn();
    emitter.on('onBottomSheetOpen', v1);
    emitter.on('panelOpen', v2);

    emitter.emit('panelOpen', { text: 'Merhaba' });

    expect(v1).toHaveBeenCalledTimes(1);
    expect(v2).toHaveBeenCalledTimes(1);
    // Both see the v2 type; only the subscription name differed.
    expect(v1.mock.calls[0][0].type).toBe('panelOpen');
  });

  it('maps every v1 name that had one', () => {
    expect(legacyAliasFor('panelClose')).toBe('onBottomSheetClose');
    expect(legacyAliasFor('videoEnd')).toBe('onVideoEnd');
    // v2-only events have no alias.
    expect(legacyAliasFor('cardCollapsed')).toBeUndefined();
    expect(legacyAliasFor('blockedSensitive')).toBeUndefined();
  });

  it('feeds onAny every event', () => {
    const emitter = new SignEventEmitter();
    const listener = jest.fn();
    emitter.onAny(listener);

    emitter.emit('textSelected', { text: 'a' });
    emitter.emit('cardCollapsed', { value: true });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].value).toBe(true);
  });

  it('stops delivering after unsubscribe', () => {
    const emitter = new SignEventEmitter();
    const listener = jest.fn();
    const off = emitter.on('videoStart', listener);

    off();
    emitter.emit('videoStart', {});

    expect(listener).not.toHaveBeenCalled();
  });

  it('survives a listener that unsubscribes itself mid-emit', () => {
    const emitter = new SignEventEmitter();
    const second = jest.fn();
    const off = emitter.on('videoStart', () => off());
    emitter.on('videoStart', second);

    expect(() => emitter.emit('videoStart', {})).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not let a throwing host listener break the flow', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const emitter = new SignEventEmitter();
    const healthy = jest.fn();

    emitter.on('videoStart', () => {
      throw new Error('host bug');
    });
    emitter.on('videoStart', healthy);

    expect(() => emitter.emit('videoStart', {})).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it('makes emitting to a closed stream a no-op, not an error', () => {
    const emitter = new SignEventEmitter();
    const listener = jest.fn();
    emitter.on('videoStart', listener);

    emitter.close();

    expect(emitter.isClosed).toBe(true);
    expect(() => emitter.emit('videoStart', {})).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
    // Subscribing afterwards is harmless too.
    expect(() => emitter.on('videoStart', listener)()).not.toThrow();
  });
});

describe('signError', () => {
  it('carries a message for logs', () => {
    const error = signError('API_ERROR', 'HTTP 500', { status: 500 });
    expect(error).toEqual({
      code: 'API_ERROR',
      message: 'HTTP 500',
      details: { status: 500 },
    });
  });
});
