import Feather from '@expo/vector-icons/Feather';
import { ComponentProps, ComponentRef, ReactNode, Ref, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

import { announce } from '@/lib/a11y';
import { sourceLabels, STATUS_LABELS } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius, StatusKey, ThemeColors, TOUCH } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

// Line icons only (Feather), so no emoji or text symbols stand in for icons. Icons are decorative: whatever they
// mean is always in the text or the accessibility label next to them.
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Feather name={name} size={size} color={color} accessible={false} importantForAccessibility="no" aria-hidden />
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.alertButton : colors.primarySoft;
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.onAlertButton : colors.primarySoftText;
  return (
    <Pressable
      accessibilityRole="button"
      // The label stays even while the spinner replaces the text, and "busy" tells the screen reader to wait.
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!(disabled || loading)}
      aria-busy={!!loading}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon && <Icon name={icon} size={20} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// A choice in a group (role "radio", the default) or a one-off action that looks like a chip (role "button").
export function Chip({
  label,
  selected,
  onPress,
  danger,
  role = 'radio',
  accessibilityHint,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  danger?: boolean;
  role?: 'radio' | 'button';
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const fill = danger ? (selected ? colors.alertButton : colors.alertBg) : selected ? colors.primary : undefined;
  const fg = danger ? (selected ? colors.onAlertButton : colors.alertText) : selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-checked={role === 'radio' ? selected : undefined}
      aria-pressed={role === 'button' && selected ? true : undefined}
      onPress={onPress}
      style={[styles.chip, fill !== undefined && { backgroundColor: fill, borderColor: fill }]}
    >
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// `hint` is shown under the field and also read by screen readers as the field's hint.
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        accessibilityHint={hint}
        {...props}
        style={[styles.input, props.style]}
      />
      {hint ? (
        <Text style={[styles.muted, { marginTop: 4 }]} importantForAccessibility="no" accessibilityElementsHidden>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// `label` makes the card one item for screen readers (e.g. a report card read as a single sentence).
export function Card({ children, style, label }: { children: ReactNode; style?: ViewStyle; label?: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]} accessible={label ? true : undefined} accessibilityLabel={label}>
      {children}
    </View>
  );
}

// Screen titles: read as headings, so screen-reader users can jump between sections.
export function Heading({
  children,
  level = 1,
  style,
  ref,
}: {
  children: ReactNode;
  level?: 1 | 2;
  style?: object;
  ref?: Ref<ComponentRef<typeof Text>>;
}) {
  const styles = useStyles();
  return (
    <Text ref={ref} accessibilityRole="header" aria-level={level} style={[level === 1 ? styles.h1 : styles.h2, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.label}>{children}</Text>;
}

export function StatusBadge({ status }: { status: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const soft = colors.statusSoft[status as StatusKey] ?? colors.statusSoft.rejected;
  return (
    <View style={[styles.badge, { backgroundColor: soft.bg }]}>
      <Text style={[styles.badgeText, { color: soft.text }]}>{STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

// "Raport utilizator – neverificat", "Date simulate", or "Verificat de un recenzent" once a reviewer validated it.
export function SourceBadge({ simulated, verification }: { simulated: boolean; verification?: string }) {
  const styles = useStyles();
  return (
    <>
      {sourceLabels(simulated, verification).map((label) => (
        <View key={label} style={[styles.badge, styles.badgeOutline]}>
          <Text style={[styles.badgeText, styles.mutedColor]}>{label}</Text>
        </View>
      ))}
    </>
  );
}

// Errors are announced as soon as they appear, so they are not missed below the fold: exactly once per platform
// (the web reads role="alert" by itself; the phone app gets an explicit announcement).
export function ErrorText({ children }: { children: ReactNode }) {
  const styles = useStyles();
  useEffect(() => {
    if (Platform.OS !== 'web' && typeof children === 'string' && children) announce(children, { urgent: true });
  }, [children]);
  return children ? (
    <Text style={styles.error} role={Platform.OS === 'web' ? 'alert' : undefined}>
      {children}
    </Text>
  ) : null;
}

export function useStyles() {
  const { colors } = useTheme();
  const tabSpace = useTabBarSpace();
  return useMemo(() => makeStyles(colors, tabSpace), [colors, tabSpace]);
}

// How much larger than normal text is drawn (the phone's or browser's font size setting).
export function useTextScale(): number {
  return useWindowDimensions().fontScale || 1;
}

// The floating tab bar grows with large text so its labels are never clipped.
export function useTabBarHeight(): number {
  return Math.round(68 + Math.max(0, useTextScale() - 1) * 24);
}

// Room for the floating tab bar under scrolling content.
export function useTabBarSpace(): number {
  return useTabBarHeight() + 44;
}

function makeStyles(c: ThemeColors, tabSpace: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: tabSpace },
    h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, color: c.text, marginBottom: 12 },
    h2: { fontFamily: fonts.extrabold, fontSize: 19, lineHeight: 25, color: c.text, marginTop: 16, marginBottom: 8 },
    body: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, color: c.text },
    muted: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: c.muted },
    mutedColor: { color: c.muted },
    label: { fontFamily: fonts.bold, fontSize: 15, color: c.text, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.input,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 50,
      fontFamily: fonts.semibold,
      fontSize: 16,
      backgroundColor: c.card,
      color: c.text,
    },
    button: {
      borderRadius: radius.button,
      minHeight: 52,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 5,
    },
    buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    buttonText: { fontFamily: fonts.extrabold, fontSize: 16, textAlign: 'center' },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: radius.chip,
      minHeight: TOUCH,
      paddingHorizontal: 16,
      justifyContent: 'center',
      marginRight: 8,
      marginBottom: 8,
    },
    chipText: { fontFamily: fonts.bold, fontSize: 14 },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 12,
    },
    badge: { borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginRight: 6, marginTop: 4 },
    badgeOutline: { borderWidth: 1, borderColor: c.border },
    badgeText: { fontFamily: fonts.extrabold, fontSize: 12 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    error: { fontFamily: fonts.bold, color: c.alertText, marginVertical: 8, fontSize: 14 },
  });
}
