import { View } from 'react-native';

import { Text } from '@/components/AppText';
import { PublicCluster, PublicReport } from '@/lib/api';
import { describeFrom, Point, sortByDistance } from '@/lib/geo';
import {
  CATEGORY_LABELS,
  confirmLabel,
  observationsCountLabel,
  reportsCountLabel,
  sourceLabels,
  STATUS_LABELS,
  t,
  timeAgo,
} from '@/lib/i18n';
import { Button, SourceBadge, StatusBadge, useStyles } from './ui';

// Text alternative to the map: reports or hotspot clusters sorted nearest first when position is known.
export function ReportList({
  reports,
  clusters = [],
  mode = 'points',
  origin,
  onToggleConfirm,
  confirmBusyId,
}: {
  reports: PublicReport[];
  clusters?: PublicCluster[];
  mode?: 'points' | 'clusters';
  origin: Point | null;
  onToggleConfirm?: (publicId: string) => void;
  confirmBusyId?: string | null;
}) {
  const styles = useStyles();

  if (mode === 'clusters') {
    if (clusters.length === 0) return <Text style={styles.muted}>{t.clusterEmpty}</Text>;
    const anyStreet = clusters.some((c) => c.area_street);
    return (
      <View role="list">
        {sortByDistance(clusters, origin).map((c) => {
          const category = CATEGORY_LABELS[c.top_category] ?? c.top_category;
          const where = origin ? describeFrom(origin, c) : null;
          const summary = [
            t.clusterTitle,
            observationsCountLabel(c.total_observations),
            `${reportsCountLabel(c.reports_count)}, ${confirmLabel(c.confirmations_count)}`,
            category,
            where,
            c.area_street && `${t.nearStreet} ${c.area_street}`,
            timeAgo(c.latest_observed_date),
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <View key={c.id} style={styles.card} accessible role="listitem" accessibilityLabel={summary}>
              <View style={[styles.row, { gap: 6 }]}>
                <View style={[styles.badge, styles.badgeOutline]}>
                  <Text style={styles.badgeText}>{observationsCountLabel(c.total_observations)}</Text>
                </View>
                <Text style={[styles.muted, { marginTop: 4 }]}>{timeAgo(c.latest_observed_date)}</Text>
              </View>
              <Text style={[styles.body, { fontFamily: styles.label.fontFamily, marginTop: 4 }]}>{category}</Text>
              <Text style={styles.muted}>
                {reportsCountLabel(c.reports_count)} · {confirmLabel(c.confirmations_count)}
              </Text>
              {where && <Text style={styles.body}>{where}</Text>}
              {c.area_street && (
                <Text style={styles.muted}>
                  {t.nearStreet} {c.area_street}
                </Text>
              )}
              {c.is_simulated && (
                <View style={styles.row}>
                  <SourceBadge simulated />
                </View>
              )}
              <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>{c.disclaimer}</Text>
            </View>
          );
        })}
        {anyStreet && <Text style={styles.muted}>{t.osmAttribution}</Text>}
      </View>
    );
  }

  if (reports.length === 0) return <Text style={styles.muted}>{t.listEmpty}</Text>;
  const anyStreet = reports.some((r) => r.area_street);
  return (
    <View role="list">
      {sortByDistance(reports, origin).map((r) => {
        const category = CATEGORY_LABELS[r.category] ?? r.category;
        const status = STATUS_LABELS[r.status] ?? r.status;
        const where = origin ? describeFrom(origin, r) : null;
        const street = r.area_street;
        const source = sourceLabels(r.is_simulated, r.verification).join(', ');
        const spoken = [
          category,
          status,
          confirmLabel(r.confirmations_count),
          where,
          street && `${t.nearStreet} ${street}`,
          timeAgo(r.observed_date),
          source,
        ]
          .filter(Boolean)
          .join(', ');
        const canConfirm = r.status !== 'resolved' && r.status !== 'expired';
        return (
          <View key={r.public_id} style={styles.card} role="listitem">
            {/* Summary grouped separately from the confirm button so TalkBack can focus and activate the button. */}
            <View accessible accessibilityLabel={spoken}>
              <View style={[styles.row, { gap: 6 }]}>
                <StatusBadge status={r.status} />
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  {timeAgo(r.observed_date)} · {confirmLabel(r.confirmations_count)}
                </Text>
              </View>
              <Text style={[styles.body, { fontFamily: styles.label.fontFamily, marginTop: 4 }]}>{category}</Text>
              {where && <Text style={styles.body}>{where}</Text>}
              {street && (
                <Text style={styles.muted}>
                  {t.nearStreet} {street}
                </Text>
              )}
              <Text style={styles.muted}>{source}</Text>
            </View>
            {onToggleConfirm && canConfirm && (
              <Button
                title={r.confirmed_by_me ? t.confirmedUndo : t.confirmMeToo}
                icon={r.confirmed_by_me ? 'check' : 'thumbs-up'}
                variant={r.confirmed_by_me ? 'primary' : 'secondary'}
                loading={confirmBusyId === r.public_id}
                disabled={!!confirmBusyId}
                onPress={() => onToggleConfirm(r.public_id)}
              />
            )}
          </View>
        );
      })}
      {anyStreet && <Text style={styles.muted}>{t.osmAttribution}</Text>}
    </View>
  );
}
