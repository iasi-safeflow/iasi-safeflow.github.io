import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LeafletMap, MapMarker } from '@/components/LeafletMap';
import { Chip, ErrorText, styles } from '@/components/ui';
import { api, errorText, PublicReport } from '@/lib/api';
import { CATEGORY_LABELS, formatDate, STATUS_COLORS, STATUS_LABELS, t } from '@/lib/i18n';

// Public map: no login, privacy-safe fields only (rounded location, category, status, date).
export default function PublicMapScreen() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      const q = category ? `?category=${category}` : '';
      api<PublicReport[]>('/public/reports' + q)
        .then((r) => {
          setReports(r);
          setError('');
        })
        .catch((e) => setError(errorText(e)));
    }, [category]),
  );

  const markers: MapMarker[] = useMemo(
    () =>
      reports.map((r) => ({
        id: r.public_id,
        lat: r.lat,
        lon: r.lon,
        color: STATUS_COLORS[r.status] ?? '#1f6feb',
        popupLines: [
          CATEGORY_LABELS[r.category] ?? r.category,
          `Status: ${STATUS_LABELS[r.status] ?? r.status}`,
          `Observat: ${formatDate(r.observed_date)}`,
          r.is_simulated ? t.sourceSimulated : t.sourceUserReport,
          r.public_id,
        ],
      })),
    [reports],
  );

  return (
    <View style={styles.screen}>
      <LeafletMap markers={markers} style={{ flex: 1 }} />
      <View style={{ maxHeight: 170, padding: 12 }}>
        <Text style={styles.muted}>{t.mapDisclaimer}</Text>
        <ErrorText>{error}</ErrorText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <Chip label={t.all} selected={!category} onPress={() => setCategory(null)} />
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Chip key={key} label={label} selected={category === key} onPress={() => setCategory(key)} />
          ))}
        </ScrollView>
        <View style={[styles.row, { marginTop: 4 }]}>
          {Object.entries(STATUS_LABELS)
            .filter(([k]) => k !== 'rejected')
            .map(([k, label]) => (
              <Text key={k} style={[styles.muted, { marginRight: 10 }]}>
                <Text style={{ color: STATUS_COLORS[k] }}>●</Text> {label}
              </Text>
            ))}
        </View>
      </View>
    </View>
  );
}
