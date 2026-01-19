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
 * View component that enables sign language translation for all text within
 *
 * Wrap any View with this component to enable text selection and
 * sign language translation for all Text components inside.
 *
 * @example
 * ```tsx
 * <SignLanguageView style={{ padding: 16 }}>
 *   <Text>First paragraph of text</Text>
 *   <Text>Second paragraph of text</Text>
 *   <View>
 *     <Text>Nested text is also selectable</Text>
 *   </View>
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
