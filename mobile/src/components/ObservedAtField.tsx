import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Text, View } from 'react-native';

import { formatDateTime, t } from '@/lib/i18n';

import { Chip, useStyles } from './ui';

// Native observed-time picker. ObservedAtField.web.tsx is the browser counterpart.

type Props = { value: Date; onChange: (d: Date) => void };

export function ObservedAtField({ value, onChange }: Props) {
  const styles = useStyles();
  const pickDate = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (ev, date) => {
          if (ev.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (ev2, time) => {
              if (ev2.type === 'set' && time) onChange(time > new Date() ? new Date() : time);
            },
          });
        },
      });
    }
  };

  if (Platform.OS === 'ios') {
    return <DateTimePicker value={value} mode="datetime" maximumDate={new Date()} onChange={(_, d) => d && onChange(d)} />;
  }
  return (
    <>
      <Text style={styles.body}>{formatDateTime(value.toISOString())}</Text>
      <View style={styles.row}>
        <Chip label={t.now} selected={false} onPress={() => onChange(new Date())} />
        <Chip label={t.pickDate} selected={false} onPress={pickDate} />
      </View>
    </>
  );
}
