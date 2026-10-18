import { Text, View } from 'react-native';

import { PublicReport } from '@/lib/api';
import { describeFrom, Point, sortByDistance } from '@/lib/geo';
import { CATEGORY_LABELS, sourceLabels, STATUS_LABELS, t, timeAgo } from '@/lib/i18n';
import { StatusBadge, useStyles } from './ui';

// Text alternative to the map: the same reports as a list, nearest first when the position is known.
// Each item is one element for screen readers, read as a single sentence.
export function ReportList({
  reports,
  origin,
  streets = {},
}: {
  reports: PublicReport[];
  origin: Point | null;
  streets?: Record<string, string>;
}) {
  const styles = useStyles();
  if (reports.length === 0) return <Text style={styles.muted}>{t.listEmpty}</Text>;
  return (
    <View role="list">
      {sortByDistance(reports, origin).map((r) => {
        const category = CATEGORY_LABELS[r.category] ?? r.category;
        const status = STATUS_LABELS[r.status] ?? r.status;
        const where = origin ? describeFrom(origin, r) : null;
        const street = streets[r.public_id];
        const source = sourceLabels(r.is_simulated, r.verification).join(', ');
        const spoken = [category, status, where, street && `${t.nearStreet} ${street}`, timeAgo(r.observed_date), source]
          .filter(Boolean)
          .join(', ');
        return (
          <View key={r.public_id} style={styles.card} accessible role="listitem" accessibilityLabel={spoken}>
            <View style={[styles.row, { gap: 6 }]}>
              <StatusBadge status={r.status} />
              <Text style={[styles.muted, { marginTop: 4 }]}>{timeAgo(r.observed_date)}</Text>
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
        );
      })}
    </View>
  );
}
