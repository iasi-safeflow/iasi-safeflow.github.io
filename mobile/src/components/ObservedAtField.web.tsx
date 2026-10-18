import { createElement } from 'react';
import { Text, View } from 'react-native';

import { formatDateTime, t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius } from '@/theme';

import { Chip, useStyles } from './ui';

// Web observed-time picker: the browser's native datetime-local input (local time, capped at now).

type Props = { value: Date; onChange: (d: Date) => void };

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function ObservedAtField({ value, onChange }: Props) {
  const { colors, dark } = useTheme();
  const styles = useStyles();
  // react-native-web renders plain DOM elements created with createElement.
  const input = createElement('input', {
    type: 'datetime-local',
    value: toLocalInput(value),
    max: toLocalInput(new Date()),
    'aria-label': t.observedAt,
    onChange: (e: { target: { value: string } }) => {
      if (!e.target.value) return;
      const d = new Date(e.target.value); // parsed as local time
      if (!Number.isNaN(d.getTime())) onChange(d > new Date() ? new Date() : d);
    },
    style: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      padding: 12,
      minHeight: 48,
      borderRadius: radius.input,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.card,
      color: colors.text,
      colorScheme: dark ? 'dark' : 'light', // the browser's own picker follows the theme
      marginBottom: 8,
      maxWidth: '100%',
    },
  });
  return (
    <>
      {input}
      <Text style={styles.muted}>{formatDateTime(value.toISOString())}</Text>
      <View style={styles.row}>
        <Chip label={t.now} selected={false} onPress={() => onChange(new Date())} />
      </View>
    </>
  );
}
