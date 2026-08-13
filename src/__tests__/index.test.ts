import * as sdk from '../index';

/**
 * The public surface.
 *
 * Every v1 name is listed explicitly, because they are a contract:
 * "the v1 entry points and their parameters survive v2 unchanged". A rename
 * that slips through here breaks an integration silently.
 */
describe('the package entry point', () => {
  it.each([
    'SignLanguageProvider',
    'useSignLanguageContext',
    'useSignLanguage',
    'SignLanguageText',
    'SignLanguageView',
    'SignLanguageFloatingButton',
    'SelectableTextProvider',
    'Text',
    'enableGlobalSelectableText',
    'useSelectableText',
    'SUPPORTED_LANGUAGES',
    'DEFAULT_THEME',
    'NativeSignLanguage',
  ])('still exports the v1 name %s', (name) => {
    expect(sdk).toHaveProperty(name);
    expect((sdk as Record<string, unknown>)[name]).toBeDefined();
  });

  it.each([
    'SignController',
    'useController',
    'useControllerState',
    'useControllerSelector',
    'SignLanguageSensitive',
    'sensitiveRegistry',
    'LOCALIZED_STRINGS',
    'isNativeAvailable',
    'onNativeTextSelected',
  ])('exports the v2 addition %s', (name) => {
    expect(sdk).toHaveProperty(name);
    expect((sdk as Record<string, unknown>)[name]).toBeDefined();
  });
});
