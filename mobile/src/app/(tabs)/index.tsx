import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { CommentsModal } from '@/components/CommentsModal';
import { EmergencyBanner } from '@/components/EmergencyBanner';
import { LeafletMap, MapCluster, MapMarker } from '@/components/LeafletMap';
import { ReportList } from '@/components/ReportList';
import { StreetSearch } from '@/components/StreetSearch';
import { Button, Chip, ErrorText, Heading, Icon, SourceBadge, StatusBadge, useStyles, useTabBarSpace } from '@/components/ui';
import { announce } from '@/lib/a11y';
import { api, errorText, PublicCluster, PublicReport, UpdatesSummary } from '@/lib/api';
import { useA11y } from '@/lib/a11ySettings';
import { useAuth } from '@/lib/auth';
import { getDeviceId } from '@/lib/deviceId';
import { useHaptics } from '@/lib/feedback';
import {
  boostLabel,
  CATEGORY_LABELS,
  clustersChipLabel,
  confirmLabel,
  nearbyLabel,
  observationsCountLabel,
  reportsCountLabel,
  sourceLabels,
  STATUS_LABELS,
  STATUS_LETTERS,
  t,
  timeAgo,
} from '@/lib/i18n';
import { usePosition } from '@/lib/position';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius, StatusKey, TOUCH } from '@/theme';

// Public map: no login, privacy-safe fields only (rounded location, category, status, date).
export default function PublicMapScreen() {
  const { user, token, points, refreshPoints } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const tabSpace = useTabBarSpace();
  const haptic = useHaptics();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [clusters, setClusters] = useState<PublicCluster[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<'points' | 'clusters'>('points');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number; zoom: number; seq: number } | undefined>();
  const [error, setError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmBusyId, setConfirmBusyId] = useState<string | null>(null);
  const [commentsForId, setCommentsForId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { srMode } = useA11y();
  // The screen-reader mode opens on the list ("Probleme semnalate în apropiere"); the map stays one tap away.
  const [view, setView] = useState<'map' | 'list'>(srMode ? 'list' : 'map');
  const position = usePosition();

  useEffect(() => {
    if (srMode) setView('list');
  }, [srMode]);

  useEffect(() => {
    if (view === 'list' && position.status === 'idle') void position.request();
  }, [view, position]);

  const fetchPublicData = useCallback(async () => {
    const q = category ? `?category=${category}` : '';
    const deviceId = await getDeviceId();
    const [r, c] = await Promise.all([
      api<PublicReport[]>('/public/reports' + q, { token, headers: { 'X-Device-Id': deviceId } }),
      api<PublicCluster[]>('/public/clusters' + q),
    ]);
    return { r, c };
  }, [category, token]);

  useFocusEffect(
    useCallback(() => {
      // The free API host can take ~20 s to wake, so ignore a response that arrives after the filter changed.
      let active = true;
      setLoading(true);
      fetchPublicData()
        .then(({ r, c }) => {
          if (!active) return;
          setReports(r);
          setClusters(c);
          setError('');
        })
        .catch((e) => active && setError(errorText(e)))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [fetchPublicData]),
  );

  const toggleConfirm = useCallback(
    async (publicId: string) => {
      setConfirmBusyId(publicId);
      setConfirmError('');
      try {
        const deviceId = await getDeviceId();
        const res = await api<{ public_id: string; confirmations_count: number; confirmed_by_me: boolean }>(
          `/public/reports/${publicId}/confirm`,
          { method: 'POST', token, headers: { 'X-Device-Id': deviceId } },
        );
        setReports((prev) =>
          prev.map((r) =>
            r.public_id === res.public_id
              ? { ...r, confirmations_count: res.confirmations_count, confirmed_by_me: res.confirmed_by_me }
              : r,
          ),
        );
        if (res.confirmed_by_me) haptic('success');
        announce(confirmLabel(res.confirmations_count));
        const q = category ? `?category=${category}` : '';
        api<PublicCluster[]>('/public/clusters' + q).then(setClusters).catch(() => undefined);
      } catch (e) {
        setConfirmError(errorText(e));
      } finally {
        setConfirmBusyId(null);
      }
    },
    [token, category, haptic],
  );

  const boostReport = useCallback(
    async (publicId: string) => {
      if (!token) return;
      setConfirmBusyId(`boost:${publicId}`);
      setConfirmError('');
      try {
        const res = await api<{ public_id: string; boosts_count: number; boosted_by_me: boolean }>(
          `/public/reports/${publicId}/boost`,
          { method: 'POST', token },
        );
        setReports((prev) =>
          prev.map((r) =>
            r.public_id === res.public_id
              ? { ...r, boosts_count: res.boosts_count, boosted_by_me: res.boosted_by_me }
              : r,
          ),
        );
        haptic('success');
        announce(boostLabel(res.boosts_count));
        void refreshPoints();
      } catch (e) {
        setConfirmError(errorText(e));
      } finally {
        setConfirmBusyId(null);
      }
    },
    [token, haptic, refreshPoints],
  );

  const markers: MapMarker[] = useMemo(
    () =>
      mapMode === 'points'
        ? reports.map((r) => ({
            id: r.public_id,
            lat: r.lat,
            lon: r.lon,
            color: colors.status[r.status as StatusKey] ?? colors.status.submitted,
            letter: STATUS_LETTERS[r.status],
            label: `${CATEGORY_LABELS[r.category] ?? r.category}, ${STATUS_LABELS[r.status] ?? r.status}`,
          }))
        : [],
    [reports, colors, mapMode],
  );

  const mapClusters: MapCluster[] = useMemo(
    () =>
      mapMode === 'clusters'
        ? clusters.map((c) => ({
            id: c.id,
            lat: c.lat,
            lon: c.lon,
            radius_m: c.radius_m,
            count: c.total_observations,
            color: colors.primary,
            label: `${observationsCountLabel(c.total_observations)}, ${CATEGORY_LABELS[c.top_category] ?? c.top_category}`,
          }))
        : [],
    [clusters, colors.primary, mapMode],
  );

  const selected = mapMode === 'points' ? reports.find((r) => r.public_id === selectedId) : undefined;
  const selectedCluster = mapMode === 'clusters' ? clusters.find((c) => c.id === selectedClusterId) : undefined;
  const commentsReport = reports.find((r) => r.public_id === commentsForId) ?? null;

  const onCommentUpdated = useCallback((publicId: string, summary: UpdatesSummary, approvedCount: number) => {
    setReports((prev) =>
      prev.map((r) =>
        r.public_id === publicId ? { ...r, updates_summary: summary, approved_comments_count: approvedCount } : r,
      ),
    );
  }, []);

  // Screen-reader users hear how many reports there are once they have loaded.
  useEffect(() => {
    if (!loading && !error) announce(t.mapLoaded.replace('{n}', String(reports.length)));
  }, [loading, error, reports.length]);

  const switchMode = (next: 'points' | 'clusters') => {
    setMapMode(next);
    setSelectedId(null);
    setSelectedClusterId(null);
    setConfirmError('');
  };

  return (
    <View style={[styles.screen, { paddingBottom: tabSpace - 16 }]}>
      {/* The 112 bar comes first here too, so screen readers read it before anything else. */}
      <EmergencyBanner />

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

      <View style={s.controlsRow}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.modeGroupA11y} style={{ flexDirection: 'row', flex: 1 }}>
          <Chip label={t.modePoints} selected={mapMode === 'points'} onPress={() => switchMode('points')} />
          <Chip label={t.modeClusters} selected={mapMode === 'clusters'} onPress={() => switchMode('clusters')} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={view === 'map' ? t.showList : t.showMap}
          accessibilityHint={view === 'map' ? t.showListHint : undefined}
          onPress={() => setView(view === 'map' ? 'list' : 'map')}
          style={({ pressed }) => [
            s.viewBtn,
            { backgroundColor: colors.primarySoft, borderColor: colors.border, borderWidth: colors.lineWidth, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name={view === 'map' ? 'list' : 'map'} size={16} color={colors.primarySoftText} />
          <Text style={[s.viewBtnText, { color: colors.primarySoftText }]}>{view === 'map' ? t.showList : t.showMap}</Text>
        </Pressable>
      </View>

      {view === 'list' ? (
        // focusable: on the web the scrolling list can also be reached and scrolled with the keyboard.
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} focusable>
          <Heading level={2} style={{ marginTop: 4 }}>
            {mapMode === 'clusters' ? t.modeClusters : t.listTitle}
          </Heading>
          <ErrorText>{confirmError}</ErrorText>
          {position.status === 'locating' && <Text style={styles.muted}>{t.listLocating}</Text>}
          {(position.status === 'denied' || position.status === 'failed') && (
            <Text style={[styles.muted, { marginBottom: 8 }]}>{t.listNoLocation}</Text>
          )}
          {loading ? (
            <Text style={styles.muted}>{t.mapLoading}</Text>
          ) : (
            <ReportList
              reports={reports}
              clusters={clusters}
              mode={mapMode}
              origin={position.point}
              onToggleConfirm={toggleConfirm}
              onBoost={user ? boostReport : undefined}
              onOpenComments={setCommentsForId}
              canBoost={!!points && points.balance >= points.boost_cost}
              confirmBusyId={confirmBusyId}
            />
          )}
        </ScrollView>
      ) : (
        <>
          <StreetSearch
            token={token}
            onSelect={(r) => {
              setSelectedId(null);
              setSelectedClusterId(null);
              setMapCenter((prev) => ({ lat: r.lat, lon: r.lon, zoom: 16, seq: (prev?.seq ?? 0) + 1 }));
              announce(t.streetCentered.replace('{label}', r.label));
            }}
            style={{ marginHorizontal: 16, marginBottom: 8 }}
          />
          <View
            style={[s.mapCard, { borderColor: colors.border, backgroundColor: colors.map.land }]}
            // Phone app: the map is one item with a summary (its markers can't be explored by touch). Web: a labelled
            // region, so Leaflet's own keyboard controls stay reachable inside it.
            accessible={Platform.OS !== 'web'}
            role={Platform.OS === 'web' ? 'region' : undefined}
            accessibilityLabel={t.mapA11y.replace('{n}', String(reports.length))}
          >
            <LeafletMap
              markers={markers}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setConfirmError('');
              }}
              clusters={mapClusters}
              selectedClusterId={selectedClusterId}
              onSelectCluster={setSelectedClusterId}
              center={mapCenter}
              style={{ flex: 1 }}
            />
            <View pointerEvents="none" style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {loading ? (
                <>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[s.chipText, { color: colors.text, flex: 1 }]}>{t.mapLoading}</Text>
                </>
              ) : (
                <>
                  <Icon name={mapMode === 'clusters' ? 'layers' : 'map-pin'} size={16} color={colors.primary} />
                  <Text style={[s.chipText, { color: colors.text }]}>
                    {mapMode === 'clusters' ? clustersChipLabel(clusters.length) : nearbyLabel(reports.length)}
                  </Text>
                </>
              )}
            </View>
            {selected && (
              <View style={[s.selected, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.row, { gap: 8 }]}>
                  <StatusBadge status={selected.status} />
                  <Text style={[styles.muted, { marginTop: 4, flex: 1 }]}>
                    {timeAgo(selected.observed_date)} · {confirmLabel(selected.confirmations_count)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.closeCard}
                    onPress={() => {
                      setSelectedId(null);
                      setConfirmError('');
                    }}
                    hitSlop={8}
                    style={s.close}
                  >
                    <Icon name="x" size={20} color={colors.muted} />
                  </Pressable>
                </View>
                <Text style={[s.selectedTitle, { color: colors.text }]}>{CATEGORY_LABELS[selected.category] ?? selected.category}</Text>
                <Text style={styles.muted}>
                  {sourceLabels(selected.is_simulated, selected.verification).join(' · ')} · {t.approxZone} · {selected.public_id}
                  {selected.boosts_count > 0 ? ` · ${boostLabel(selected.boosts_count)}` : ''}
                </Text>
                {selected.area_street && (
                  <Text style={[styles.muted, { marginTop: 2 }]}>
                    {t.nearStreet} {selected.area_street}
                  </Text>
                )}
                <ErrorText>{confirmError}</ErrorText>
                {selected.status !== 'resolved' && selected.status !== 'expired' && (
                  <View style={{ marginTop: 6 }}>
                    <Button
                      title={selected.confirmed_by_me ? t.confirmedUndo : t.confirmMeToo}
                      icon={selected.confirmed_by_me ? 'check' : 'thumbs-up'}
                      variant={selected.confirmed_by_me ? 'primary' : 'secondary'}
                      loading={confirmBusyId === selected.public_id}
                      disabled={!!confirmBusyId}
                      onPress={() => toggleConfirm(selected.public_id)}
                    />
                      <Button
                        title={`${t.updatesButton} (${selected.approved_comments_count})`}
                        icon="message-square"
                        variant="secondary"
                        onPress={() => setCommentsForId(selected.public_id)}
                      />
                    {user && points && (
                      selected.boosted_by_me ? (
                        <Text style={[styles.muted, { marginTop: 4 }]}>{t.boostedLabel}</Text>
                      ) : points.balance >= points.boost_cost ? (
                        <Button
                          title={t.boostButton}
                          icon="zap"
                          variant="secondary"
                          loading={confirmBusyId === `boost:${selected.public_id}`}
                          disabled={!!confirmBusyId}
                          onPress={() => boostReport(selected.public_id)}
                        />
                      ) : (
                        <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>
                          {t.boostNeedPoints
                            .replace('{b}', String(points.balance))
                            .replace('{c}', String(points.boost_cost))}
                        </Text>
                      )
                    )}
                  </View>
                )}
              </View>
            )}
            {selectedCluster && (
              <View style={[s.selected, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.row, { gap: 8 }]}>
                  <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.badgeText, { color: colors.primarySoftText }]}>
                      {observationsCountLabel(selectedCluster.total_observations)}
                    </Text>
                  </View>
                  <Text style={[styles.muted, { marginTop: 4, flex: 1 }]}>{timeAgo(selectedCluster.latest_observed_date)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.closeCard}
                    onPress={() => setSelectedClusterId(null)}
                    hitSlop={8}
                    style={s.close}
                  >
                    <Icon name="x" size={20} color={colors.muted} />
                  </Pressable>
                </View>
                <Text style={[s.selectedTitle, { color: colors.text }]}>
                  {CATEGORY_LABELS[selectedCluster.top_category] ?? selectedCluster.top_category}
                </Text>
                <Text style={styles.muted}>
                  {reportsCountLabel(selectedCluster.reports_count)} · {confirmLabel(selectedCluster.confirmations_count)}
                  {selectedCluster.area_street ? ` · ${t.nearStreet} ${selectedCluster.area_street}` : ''}
                </Text>
                {selectedCluster.is_simulated && (
                  <View style={styles.row}>
                    <SourceBadge simulated />
                  </View>
                )}
                <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>{selectedCluster.disclaimer}</Text>
                <View style={{ marginTop: 6 }}>
                  <Button
                    title={t.clusterViewPoints}
                    icon="map-pin"
                    variant="secondary"
                    onPress={() => {
                      const target = { lat: selectedCluster.lat, lon: selectedCluster.lon };
                      switchMode('points');
                      setMapCenter((prev) => ({ ...target, zoom: 17, seq: (prev?.seq ?? 0) + 1 }));
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        </>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText>{error}</ErrorText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          accessibilityRole="radiogroup"
          accessibilityLabel={t.categoryFilter}
        >
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
                <View
                  style={[s.dot, { backgroundColor: colors.status[k as StatusKey] }]}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                />
                <Text style={[styles.muted, { fontSize: 12 }]}>
                  {colors.highContrast ? `${STATUS_LETTERS[k]} = ${label}` : label}
                </Text>
              </View>
            ))}
        </View>
        <Text style={[styles.muted, { fontSize: 12, marginTop: 2 }]}>{t.mapDisclaimer}</Text>
      </View>
      <CommentsModal
        report={commentsReport}
        onClose={() => setCommentsForId(null)}
        onUpdated={onCommentUpdated}
      />
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
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.card,
    minHeight: 72,
  },
  ctaIcon: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontFamily: fonts.black, fontSize: 18 },
  ctaSub: { fontFamily: fonts.semibold, fontSize: 14 },
  controlsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 2 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  viewBtnText: { fontFamily: fonts.extrabold, fontSize: 14 },
  mapCard: { flex: 1, minHeight: 180, marginHorizontal: 16, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
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
