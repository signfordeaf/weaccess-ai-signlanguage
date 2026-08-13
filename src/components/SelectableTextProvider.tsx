// src/components/SelectableTextProvider.tsx

import React, { createContext, useContext, type ReactNode } from 'react';
import { Text as RNText, TextProps } from 'react-native';

/**
 * Context to enable automatic text selectability
 */
const SelectableTextContext = createContext<boolean>(false);

/**
 * Hook to check if we're inside a SelectableTextProvider
 */
export const useSelectableText = () => useContext(SelectableTextContext);

/**
 * Provider that makes all nested Text components selectable automatically.
 *
 * When you wrap your app with this provider, all Text components inside
 * will be automatically selectable for sign language translation.
 *
 * @example
 * ```tsx
 * import { SelectableTextProvider } from 'weaccess-ai-signlanguage';
 *
 * const App = () => (
 *   <SignLanguageProvider config={...}>
 *     <SelectableTextProvider>
 *       <Text>This text is now selectable!</Text>
 *       <Text>And this one too!</Text>
 *     </SelectableTextProvider>
 *   </SignLanguageProvider>
 * );
 * ```
 */
export const SelectableTextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  return (
    <SelectableTextContext.Provider value={true}>
      {children}
    </SelectableTextContext.Provider>
  );
};

/**
 * Enhanced Text component that is automatically selectable when used
 * inside a SelectableTextProvider or SignLanguageProvider.
 *
 * You can use this as a drop-in replacement for React Native's Text.
 *
 * @example
 * ```tsx
 * import { Text } from 'weaccess-ai-signlanguage';
 *
 * const MyComponent = () => (
 *   <Text>This text is selectable for sign language translation</Text>
 * );
 * ```
 */
export const Text: React.FC<TextProps & { children?: ReactNode }> = ({
  selectable,
  children,
  ...props
}) => {
  const isInsideProvider = useSelectableText();

  // Make text selectable if inside provider or explicitly set
  const shouldBeSelectable =
    selectable !== false && (selectable === true || isInsideProvider);

  return (
    <RNText selectable={shouldBeSelectable} {...props}>
      {children}
    </RNText>
  );
};

/**
 * Patch the global Text component to be selectable.
 * Call this once at app startup to make ALL Text components selectable.
 *
 * ⚠️ Warning: This modifies the global React Native Text component.
 * Use with caution in production apps.
 *
 * @example
 * ```tsx
 * import { enableGlobalSelectableText } from 'weaccess-ai-signlanguage';
 *
 * // Call this before rendering your app
 * enableGlobalSelectableText();
 * ```
 */
export const enableGlobalSelectableText = () => {
  if (__DEV__) {
    console.warn(
      '[SignLanguage] enableGlobalSelectableText() is a no-op and can be ' +
        'removed.\n' +
        'It patched Text.render, which no longer exists on React Native 0.81+ ' +
        '— so it had already stopped working there, silently.\n' +
        'You no longer need it: tap-to-translate reads text directly from the ' +
        'React tree, so text does not have to be selectable to be translated. ' +
        'Mark text `selectable` yourself only where you also want the ' +
        'system selection menu.'
    );
  }
};
