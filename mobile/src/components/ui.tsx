import Feather from '@expo/vector-icons/Feather';
import { ComponentProps, ReactNode, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { STATUS_LABELS, t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius, StatusKey, ThemeColors, TOUCH } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

// Line icons only (Feather), so no emoji or text symbols stand in for icons.
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <Feather name={name} size={size} color={color} />;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.alertButton : colors.primarySoft;
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.onAlertButton : colors.primarySoftText;
  return (
    <Pressable
      accessibilityRole="button"
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

export function Chip({ label, selected, onPress, danger }: { label: string; selected: boolean; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const fill = danger ? (selected ? colors.alertButton : colors.alertBg) : selected ? colors.primary : undefined;
  const fg = danger ? (selected ? colors.onAlertButton : colors.alertText) : selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, fill !== undefined && { backgroundColor: fill, borderColor: fill }]}
    >
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
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

// "Raport utilizator – neverificat" or "Date simulate": never shown as verified.
export function SourceBadge({ simulated }: { simulated: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.badge, styles.badgeOutline]}>
      <Text style={[styles.badgeText, styles.mutedColor]}>{simulated ? t.sourceSimulated : t.sourceUserReport}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

// Room for the floating tab bar under scrolling content.
export const TAB_BAR_SPACE = 112;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: TAB_BAR_SPACE },
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
