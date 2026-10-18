import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { DuplicatePill, FlagPill, ImportancePill, SuggestionLabel, WhyToggle } from '@/components/assistant';
import { Button, Card, Chip, ErrorText, Icon, useStyles } from '@/components/ui';
import { api, errorText, HistoryRow, ReviewerDecision } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  DECISION_LABELS,
  FLAG_LABELS,
  formatDateTime,
  IMPORTANCE_LABELS,
  REJECTION_REASON_LABELS,
  STATUS_LABELS,
  t,
  TRIGGER_LABELS,
} from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';

// Read-only log of every assistant check and what the reviewer did next (derived from the audit log).
function decisionText(d: ReviewerDecision): string {
  const label = DECISION_LABELS[d.kind] ?? d.kind;
  if (d.kind === 'rejected' && d.reason) return `${label}: ${REJECTION_REASON_LABELS[d.reason] ?? d.reason}`;
  if (d.kind === 'status_change' && d.to_status) return `${label}: ${STATUS_LABELS[d.to_status] ?? d.to_status}`;
  if (d.related_report_id) return `${label} · ${d.related_report_id}`;
  return label;
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<string, string>;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const styles = useStyles();
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[styles.label, { fontSize: 13 }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label={t.all} selected={!value} onPress={() => onChange(null)} />
        {Object.entries(options).map(([k, l]) => (
          <Chip key={k} label={l} selected={value === k} onPress={() => onChange(k)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function AssistantHistoryScreen() {
  const { user, token, ready } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [flag, setFlag] = useState<string | null>(null);
  const [importance, setImportance] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || user?.role !== 'reviewer') return;
    setRefreshing(true);
    try {
      const q = new URLSearchParams({
        ...(flag ? { flag } : {}),
        ...(importance ? { importance } : {}),
        ...(decision ? { decision } : {}),
      }).toString();
      setRows(await api<HistoryRow[]>(`/review/assistant-runs${q ? `?${q}` : ''}`, { token }));
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [token, user, flag, importance, decision]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!ready) return <View style={styles.screen} />;

  if (user?.role !== 'reviewer') {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.body}>Doar recenzenții au acces la această secțiune.</Text>
        {!user && <Button title={t.login} onPress={() => router.push('/login')} />}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <Text style={styles.h1}>{t.tabHistory}</Text>
      <Text style={[styles.muted, { marginBottom: 12 }]}>{t.historyIntro}</Text>
      <FilterRow label={t.filterFlag} options={FLAG_LABELS} value={flag} onChange={setFlag} />
      <FilterRow label={t.filterImportance} options={IMPORTANCE_LABELS} value={importance} onChange={setImportance} />
      <FilterRow label={t.filterDecision} options={DECISION_LABELS} value={decision} onChange={setDecision} />
      <ErrorText>{error}</ErrorText>
      {rows.length === 0 && !error && <Text style={styles.muted}>{t.historyEmpty}</Text>}
      {rows.map((r) => (
        <Card key={r.id}>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: r.report_id } })}
            style={[styles.row, { gap: 6 }]}
          >
            <Text style={[styles.label, { marginBottom: 0 }]}>{r.report_id}</Text>
            <Icon name="chevron-right" size={16} color={colors.muted} />
          </Pressable>
          <Text style={styles.muted}>
            {formatDateTime(r.created_at)} · {TRIGGER_LABELS[r.triggered_by] ?? r.triggered_by} · {r.assistant_version}
          </Text>
          <SuggestionLabel />
          <View style={[styles.row, { marginTop: 4 }]}>
            <ImportancePill level={r.importance.level} score={r.importance.score} />
            {r.flags.map((f) => (
              <FlagPill key={f.code} code={f.code} />
            ))}
            {r.duplicates.map((d) => (
              <DuplicatePill key={d.public_id} level={d.level} />
            ))}
          </View>
          {r.duplicates.length > 0 && (
            <Text style={[styles.muted, { marginTop: 4 }]}>{r.duplicates.map((d) => `${d.public_id} (${Math.round(d.score * 100)}%)`).join(', ')}</Text>
          )}
          <WhyToggle factors={r.importance.factors} />
          <View style={[styles.row, { gap: 6, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Icon name={r.decision.kind === 'pending' ? 'clock' : 'user-check'} size={16} color={colors.muted} />
            <Text style={[styles.body, { flex: 1 }]}>
              {t.reviewerDecision}: {decisionText(r.decision)}
            </Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
