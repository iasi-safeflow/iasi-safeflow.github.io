import { ComponentProps } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, TextStyle } from 'react-native';

import { useA11y } from '@/lib/a11ySettings';

// Text and TextInput with "Text mare" applied: font size and line height are multiplied by the setting (×1.3), on
// top of the phone's or browser's own text size, which React Native already applies. Every screen imports these
// instead of the react-native ones, so no font size is left out.

function scaled(style: ComponentProps<typeof RNText>['style'], factor: number) {
  if (factor === 1 || !style) return style;
  const flat = StyleSheet.flatten(style) as TextStyle;
  return {
    ...flat,
    ...(flat.fontSize ? { fontSize: flat.fontSize * factor } : { fontSize: 14 * factor }),
    ...(flat.lineHeight ? { lineHeight: flat.lineHeight * factor } : null),
  };
}

export function Text(props: ComponentProps<typeof RNText>) {
  const { textFactor } = useA11y();
  return <RNText {...props} style={scaled(props.style, textFactor)} />;
}

export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  const { textFactor } = useA11y();
  return <RNTextInput {...props} style={scaled(props.style, textFactor)} />;
}
