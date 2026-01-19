import React from 'react';
import {
  Text,
  type TextProps,
} from 'react-native';

export interface SignLanguageTextProps extends TextProps {
  /**
   * Child content (text)
   */
  children: React.ReactNode;
}

/**
 * Text component with sign language translation support
 *
 * This component is a simple wrapper around React Native's Text component.
 * It enables text selection by default.
 *
 * **IMPORTANT**: You don't need to use this component!
 * 
 * Once you call `SignLanguageTranslation.initialize()`, ALL native text
 * components in your app will automatically have the "Sign Language" 
 * option in their text selection menu.
 *
 * This component is provided for convenience and backward compatibility.
 *
 * @example
 * ```tsx
 * // Option 1: Use this component (optional)
 * <SignLanguageText style={{ fontSize: 18 }}>
 *   Bu metin seçilebilir ve işaret diline çevrilebilir.
 * </SignLanguageText>
 *
 * // Option 2: Use standard Text - it works the same way!
 * <Text selectable style={{ fontSize: 18 }}>
 *   Bu metin de seçilebilir ve işaret diline çevrilebilir.
 * </Text>
 * ```
 */
export const SignLanguageText: React.FC<SignLanguageTextProps> = ({
  children,
  style,
  ...props
}) => {
  // Simply use the standard Text component with selectable=true
  // The SDK automatically adds sign language menu to all text selections
  return (
    <Text selectable={true} style={style} {...props}>
      {children}
    </Text>
  );
};
