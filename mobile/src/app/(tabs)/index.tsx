import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmergencyBanner } from '@/components/EmergencyBanner';
import { LeafletMap, MapMarker } from '@/components/LeafletMap';
import { Chip, ErrorText, Icon, StatusBadge, TAB_BAR_SPACE, useStyles } from '@/components/ui';
import { api, errorText, PublicReport } from '@/lib/api';
import { CATEGORY_LABELS, nearbyLabel, sourceLabels, STATUS_LABELS, t, timeAgo } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius, StatusKey, TOUCH } from '@/theme';

// Public map: no login, privacy-safe fields only (rounded location, category, status, date).
export default function PublicMapScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        color: colors.status[r.status as StatusKey] ?? colors.status.submitted,
      })),
    [reports, colors],
  );
  const selected = reports.find((r) => r.public_id === selectedId);

  return (
    <View style={[styles.screen, { paddingBottom: TAB_BAR_SPACE - 16 }]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: colors.primarySoftText }]}>{t.homeLabel}</Text>
          <Text style={[s.greeting, { color: colors.text }]}>{t.greeting}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.tabAccount}
          onPress={() => router.push('/account')}
          style={({ pressed }) => [s.round, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="user" size={22} color={colors.primarySoftText} />
        </Pressable>
      </View>

      <EmergencyBanner />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.reportCtaTitle}, ${t.reportCtaSub}`}
        onPress={() => router.push('/report')}
        style={({ pressed }) => [s.cta, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
      >
        <View style={[s.ctaIcon, { backgroundColor: colors.onPrimary }]}>
          <Icon name="plus" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.ctaTitle, { color: colors.onPrimary }]}>{t.reportCtaTitle}</Text>
          <Text style={[s.ctaSub, { color: colors.onPrimary }]}>{t.reportCtaSub}</Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.onPrimary} />
      </Pressable>

      <View style={[s.mapCard, { borderColor: colors.border, backgroundColor: colors.map.land }]}>
        <LeafletMap markers={markers} selectedId={selectedId} onSelect={setSelectedId} style={{ flex: 1 }} />
        <View pointerEvents="none" style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {loading ? (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text style={[s.chipText, { color: colors.text, flex: 1 }]}>{t.mapLoading}</Text>
            </>
          ) : (
            <>
              <Icon name="map-pin" size={16} color={colors.primary} />
              <Text style={[s.chipText, { color: colors.text }]}>{nearbyLabel(reports.length)}</Text>
            </>
          )}
        </View>
        {selected && (
          <View style={[s.selected, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.row, { gap: 8 }]}>
              <StatusBadge status={selected.status} />
              <Text style={[styles.muted, { marginTop: 4, flex: 1 }]}>{timeAgo(selected.observed_date)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.closeCard}
                onPress={() => setSelectedId(null)}
                hitSlop={8}
                style={s.close}
              >
                <Icon name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={[s.selectedTitle, { color: colors.text }]}>{CATEGORY_LABELS[selected.category] ?? selected.category}</Text>
            <Text style={styles.muted}>
              {sourceLabels(selected.is_simulated, selected.verification).join(' · ')} · {t.approxZone} · {selected.public_id}
            </Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText>{error}</ErrorText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <Chip label={t.all} selected={!category} onPress={() => setCategory(null)} />
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Chip key={key} label={label} selected={category === key} onPress={() => setCategory(key)} />
          ))}
        </ScrollView>
        <View style={[styles.row, { columnGap: 12 }]}>
          {Object.entries(STATUS_LABELS)
            .filter(([k]) => k !== 'rejected')
            .map(([k, label]) => (
              <View key={k} style={[styles.row, { gap: 5 }]}>
                <View style={[s.dot, { backgroundColor: colors.status[k as StatusKey] }]} />
                <Text style={[styles.muted, { fontSize: 12 }]}>{label}</Text>
              </View>
            ))}
        </View>
        <Text style={[styles.muted, { fontSize: 12, marginTop: 2 }]}>{t.mapDisclaimer}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  kicker: { fontFamily: fonts.extrabold, fontSize: 13, letterSpacing: 0.4 },
  greeting: { fontFamily: fonts.black, fontSize: 24, lineHeight: 30 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.card,
    minHeight: 72,
  },
  ctaIcon: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontFamily: fonts.black, fontSize: 18 },
  ctaSub: { fontFamily: fonts.semibold, fontSize: 14 },
  mapCard: { flex: 1, minHeight: 220, marginHorizontal: 16, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  chip: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: '78%', // leaves room for the zoom buttons on the right
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontFamily: fonts.extrabold, fontSize: 13 },
  selected: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 22, borderWidth: 1, padding: 14 },
  selectedTitle: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 23, marginTop: 6, marginBottom: 2 },
  close: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: -10, marginTop: -6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
