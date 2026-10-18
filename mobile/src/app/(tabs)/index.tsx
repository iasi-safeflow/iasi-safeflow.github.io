import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, ViewStyle } from 'react-native';

import { LeafletMap, MapMarker } from '@/components/LeafletMap';
import { Chip, colors, ErrorText, styles } from '@/components/ui';
import { api, errorText, PublicReport } from '@/lib/api';
import { CATEGORY_LABELS, formatDate, STATUS_COLORS, STATUS_LABELS, t } from '@/lib/i18n';

// Public map: no login, privacy-safe fields only (rounded location, category, status, date).
export default function PublicMapScreen() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      // The free API host can take ~20 s to wake, so ignore a response that arrives after the filter changed.
      let active = true;
      const q = category ? `?category=${category}` : '';
      setLoading(true);
      api<PublicReport[]>('/public/reports' + q)
        .then((r) => {
          if (!active) return;
          setReports(r);
          setError('');
        })
        .catch((e) => active && setError(errorText(e)))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
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
      <View style={{ flex: 1 }}>
        <LeafletMap markers={markers} style={{ flex: 1 }} />
        {loading && (
          <View pointerEvents="none" style={mapLoadingStyle}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.muted, { flex: 1, marginLeft: 8 }]}>{t.mapLoading}</Text>
          </View>
        )}
      </View>
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

// Floats over the top of the map; pointerEvents="none" keeps the map usable underneath.
const mapLoadingStyle: ViewStyle = {
  position: 'absolute',
  top: 12,
  left: 56,
  right: 12,
  flexDirection: 'row',
  alignItems: 'center',
  padding: 10,
  borderRadius: 8,
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.border,
};
