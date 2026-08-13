import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { SignLanguageProvider } from '../SignLanguageProvider';
import { SignController } from '../controller/controller';
import {
  DEFAULT_THEME,
  LOCALIZED_STRINGS,
  SUPPORTED_LANGUAGES,
} from '../constants';
import { resetConfig } from '../core/config';

// There is no native module in a Jest environment, and the SDK correctly warns
// about it. Stub it so that warning does not drown out real ones.
jest.mock('../NativeSignLanguage', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setEnabled: jest.fn(),
    enableTextSelectionForView: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
  onNativeTextSelected: () => () => {},
  isNativeAvailable: () => false,
}));

const CONFIG = {
  apiKey: 'RK',
  apiUrl: 'https://api.test',
  language: 'tr' as const,
};

afterEach(() => {
  resetConfig();
});

describe('SignLanguageProvider', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <SignLanguageProvider>
        <Text>Test Child</Text>
      </SignLanguageProvider>
    );

    expect(getByText('Test Child')).toBeTruthy();
  });

  it('renders the host app untouched without credentials', () => {
    // Missing credentials in a release build must render the host app rather
    // than crash it.
    expect(() =>
      render(
        <SignLanguageProvider>
          <Text>Test Child</Text>
        </SignLanguageProvider>
      )
    ).not.toThrow();
  });

  it('configures and enables from a config object', () => {
    const controller = new SignController();

    render(
      <SignLanguageProvider config={CONFIG} controller={controller}>
        <Text>Test Child</Text>
      </SignLanguageProvider>
    );

    expect(controller.config.apiKey).toBe('RK');
    expect(controller.getState().enabled).toBe(true);
    controller.dispose();
  });

  it('leaves the SDK off when autoEnable is false', () => {
    const controller = new SignController();

    render(
      <SignLanguageProvider
        config={CONFIG}
        controller={controller}
        autoEnable={false}
      >
        <Text>Test Child</Text>
      </SignLanguageProvider>
    );

    expect(controller.getState().enabled).toBe(false);
    controller.dispose();
  });

  it('hides the floating button while the player is open', () => {
    // The player carries its own expand and close, so a second affordance for
    // the same thing is clutter.
    //
    // Fake timers so the player's entrance animation runs to completion inside
    // act() rather than ticking on after the assertions.
    jest.useFakeTimers();
    const controller = new SignController();

    const { queryByLabelText } = render(
      <SignLanguageProvider config={CONFIG} controller={controller}>
        <Text>Test Child</Text>
      </SignLanguageProvider>
    );

    const label = LOCALIZED_STRINGS.tr.translationModeLabel;
    expect(queryByLabelText(label)).toBeTruthy();

    act(() => controller.openPlayer());
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(queryByLabelText(label)).toBeNull();

    act(() => controller.close());
    expect(queryByLabelText(label)).toBeTruthy();

    act(() => {
      jest.runOnlyPendingTimers();
    });
    controller.dispose();
    jest.useRealTimers();
  });

  it('keeps the app subtree mounted across a tap-mode toggle', () => {
    // A starred regression: toggling tap mode must not reset the host app's
    // navigation stack.
    const controller = new SignController();
    const mounted = jest.fn();

    const Child = () => {
      React.useEffect(mounted, []);
      return <Text>Test Child</Text>;
    };

    render(
      <SignLanguageProvider config={CONFIG} controller={controller}>
        <Child />
      </SignLanguageProvider>
    );

    expect(mounted).toHaveBeenCalledTimes(1);

    act(() => controller.toggleTapMode());
    act(() => controller.toggleTapMode());

    expect(mounted).toHaveBeenCalledTimes(1);
    controller.dispose();
  });
});

describe('the public constants', () => {
  it('exports the supported languages with their API codes', () => {
    expect(SUPPORTED_LANGUAGES.tr).toMatchObject({
      code: '1',
      supported: true,
    });
    expect(SUPPORTED_LANGUAGES.en).toMatchObject({
      code: '2',
      supported: true,
    });
    expect(SUPPORTED_LANGUAGES.ar).toMatchObject({
      code: '6',
      supported: true,
    });
  });

  it('marks the languages the backend does not serve', () => {
    // They stay accepted for backward compatibility, but a port must not offer
    // them as translatable.
    for (const code of ['de', 'fr', 'es'] as const) {
      expect(SUPPORTED_LANGUAGES[code].supported).toBe(false);
    }
  });

  it('exports a default theme that is legible out of the box', () => {
    expect(DEFAULT_THEME.primaryColor).toBe('#6750A4');
    expect(DEFAULT_THEME.textColor).toBe('#1C1B1F');
    expect(DEFAULT_THEME.onPrimaryColor).toBe('#FFFFFF');
  });

  it('falls back to English for the unsupported languages', () => {
    expect(LOCALIZED_STRINGS.de).toBe(LOCALIZED_STRINGS.en);
    expect(LOCALIZED_STRINGS.fr).toBe(LOCALIZED_STRINGS.en);
    expect(LOCALIZED_STRINGS.es).toBe(LOCALIZED_STRINGS.en);
  });

  it('localizes every string the player draws', () => {
    for (const language of ['tr', 'en', 'ar'] as const) {
      const strings = LOCALIZED_STRINGS[language];
      for (const key of [
        'error',
        'sensitiveBlocked',
        'playLabel',
        'pauseLabel',
        'loopLabel',
        'speedLabel',
        'collapseLabel',
        'expandLabel',
        'close',
        'translationModeLabel',
        'tapToTranslateHint',
        'sensitiveBlocked',
      ] as const) {
        expect(strings[key]).toBeTruthy();
      }
    }
  });
});
