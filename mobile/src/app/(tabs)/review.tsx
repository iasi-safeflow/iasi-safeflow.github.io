import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { DuplicatePill, FlagPill, ImportancePill } from '@/components/assistant';
import { Button, Card, Chip, ErrorText, Icon, SourceBadge, StatusBadge, useStyles } from '@/components/ui';
import { api, errorText, ReviewReport } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABELS, formatDateTime, STATUS_LABELS, t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';

export default function ReviewQueueScreen() {
  const { user, token, ready } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const [items, setItems] = useState<ReviewReport[]>([]);
  const [status, setStatus] = useState<string | null>('submitted');
  const [heldOnly, setHeldOnly] = useState(false);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'importance'>('newest');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || user?.role !== 'reviewer') return;
    setRefreshing(true);
    try {
      const q = new URLSearchParams({ sort, ...(status ? { status } : {}), ...(heldOnly ? { visibility: 'held' } : {}) }).toString();
      setItems(await api<ReviewReport[]>(`/review/reports?${q}`, { token }));
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [token, user, status, sort, heldOnly]);

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
      <Text style={styles.h1}>{t.queueTitle}</Text>
      <View style={styles.chips}>
        <Chip label={t.all} selected={!status} onPress={() => setStatus(null)} />
        {Object.entries(STATUS_LABELS).map(([k, label]) => (
          <Chip key={k} label={label} selected={status === k} onPress={() => setStatus(k)} />
        ))}
      </View>
      <View style={styles.chips}>
        <Chip label={t.heldFilter} selected={heldOnly} onPress={() => setHeldOnly(!heldOnly)} />
      </View>
      <View style={styles.chips}>
        <Chip label="Cele mai noi" selected={sort === 'newest'} onPress={() => setSort('newest')} />
        <Chip label="Cele mai vechi" selected={sort === 'oldest'} onPress={() => setSort('oldest')} />
        <Chip label={t.sortImportance} selected={sort === 'importance'} onPress={() => setSort('importance')} />
      </View>
      <ErrorText>{error}</ErrorText>
      {items.length === 0 && !error && <Text style={styles.muted}>{t.queueEmpty}</Text>}
      {items.map((r) => (
        <Pressable key={r.public_id} onPress={() => router.push({ pathname: '/review/[id]', params: { id: r.public_id } })}>
          <Card>
            <View style={styles.row}>
              <Text style={[styles.label, { flex: 1 }]}>{r.public_id}</Text>
              <StatusBadge status={r.status} />
            </View>
            <Text style={styles.body}>{CATEGORY_LABELS[r.category] ?? r.category}</Text>
            <Text style={styles.muted} numberOfLines={2}>
              {r.description}
            </Text>
            <Text style={styles.muted}>
              {t.created}: {formatDateTime(r.created_at)} · {r.reporter_ref}
            </Text>
            {r.assistant && (
              <View style={styles.row}>
                <ImportancePill level={r.assistant.importance_level} score={r.assistant.importance_score} />
                {r.assistant.duplicate_level && <DuplicatePill level={r.assistant.duplicate_level} />}
                {r.assistant.flags.map((f) => (
                  <FlagPill key={f} code={f} />
                ))}
              </View>
            )}
            {r.public_visibility === 'held' && (
              <View style={[styles.row, { gap: 6, marginTop: 4 }]}>
                <Icon name="eye-off" size={14} color={colors.muted} />
                <Text style={[styles.muted, { fontSize: 13 }]}>{t.heldFilter}</Text>
              </View>
            )}
            <View style={styles.row}>
              <SourceBadge simulated={r.is_simulated} verification={r.verification} />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
