import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button, Card, Chip, ErrorText, SourceBadge, StatusBadge, useStyles } from '@/components/ui';
import { api, errorText, ReviewReport } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABELS, formatDateTime, STATUS_LABELS, t } from '@/lib/i18n';

export default function ReviewQueueScreen() {
  const { user, token, ready } = useAuth();
  const styles = useStyles();
  const [items, setItems] = useState<ReviewReport[]>([]);
  const [status, setStatus] = useState<string | null>('submitted');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || user?.role !== 'reviewer') return;
    setRefreshing(true);
    try {
      const q = new URLSearchParams({ sort, ...(status ? { status } : {}) }).toString();
      setItems(await api<ReviewReport[]>(`/review/reports?${q}`, { token }));
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [token, user, status, sort]);

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
        <Chip label="Cele mai noi" selected={sort === 'newest'} onPress={() => setSort('newest')} />
        <Chip label="Cele mai vechi" selected={sort === 'oldest'} onPress={() => setSort('oldest')} />
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
            <View style={styles.row}>
              <SourceBadge simulated={r.is_simulated} verification={r.verification} />
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
