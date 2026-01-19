import { NativeModules, Platform } from 'react-native';
import type { SignLanguageNativeSpec } from './types';

const LINKING_ERROR =
  `The package 'weaccess-ai-signlanguage' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const NativeSignLanguage: SignLanguageNativeSpec =
  NativeModules.SignLanguageModule
    ? NativeModules.SignLanguageModule
    : new Proxy(
        {},
        {
          get() {
            throw new Error(LINKING_ERROR);
          },
        }
      );

export default NativeSignLanguage;
