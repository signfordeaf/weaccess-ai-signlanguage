import React, { useEffect, useRef, type ReactNode } from 'react';
import { View, type ViewProps, findNodeHandle } from 'react-native';
import NativeSignLanguage from '../NativeSignLanguage';

export interface SignLanguageViewProps extends ViewProps {
  /**
   * Child content
   */
  children: ReactNode;
}

/**
 * A region opted into the platform's text-selection menu.
 *
 * **You rarely need this.** Tap-to-translate reads text straight from the React
 * tree, so every `Text` in the app is already translatable by tapping it while
 * the player is open. This only registers the subtree with the native
 * selection-menu integration, for hosts that also want the "Sign Language" item
 * on text they made selectable.
 *
 * @example
 * ```tsx
 * <SignLanguageView style={{ padding: 16 }}>
 *   <Text selectable>First paragraph of text</Text>
 * </SignLanguageView>
 * ```
 */
export const SignLanguageView: React.FC<SignLanguageViewProps> = ({
  children,
  ...props
}) => {
  const viewRef = useRef<View>(null);

  useEffect(() => {
    // Enable text selection for all text views within this container
    if (viewRef.current) {
      const nodeHandle = findNodeHandle(viewRef.current);
      if (nodeHandle) {
        NativeSignLanguage.enableTextSelectionForView(nodeHandle);
      }
    }
  }, []);

  return (
    <View ref={viewRef} {...props}>
      {children}
    </View>
  );
};
