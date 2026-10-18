import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button, Card, ErrorText, Field, Icon, SourceBadge, StatusBadge, useStyles } from '@/components/ui';
import { api, ApiError, errorText, OwnReport, PublicReport } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABELS, formatDate, formatDateTime, REJECTION_REASON_TEXT, t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';

export default function MyReportsScreen() {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const [reports, setReports] = useState<OwnReport[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookup, setLookup] = useState<PublicReport | null>(null);
  const [lookupError, setLookupError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      setReports(await api<OwnReport[]>('/reports/mine', { token }));
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const doLookup = async () => {
    setLookup(null);
    setLookupError('');
    try {
      setLookup(await api<PublicReport>(`/public/reports/${encodeURIComponent(lookupId.trim())}`));
    } catch (e) {
      setLookupError(e instanceof ApiError && e.status === 404 ? t.notFound : errorText(e));
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h2}>{t.lookupTitle}</Text>
      <Field label={t.reportId} value={lookupId} onChangeText={setLookupId} autoCapitalize="characters" placeholder="SF-XXXXXXXX" />
      <Button title={t.lookup} variant="secondary" icon="search" onPress={doLookup} disabled={lookupId.trim().length < 4} />
      <ErrorText>{lookupError}</ErrorText>
      {lookup && (
        <Card>
          <Text style={styles.label}>{lookup.public_id}</Text>
          <Text style={styles.body}>{CATEGORY_LABELS[lookup.category] ?? lookup.category}</Text>
          <View style={styles.row}>
            <StatusBadge status={lookup.status} />
            <SourceBadge simulated={lookup.is_simulated} verification={lookup.verification} />
          </View>
          <Text style={styles.muted}>
            {t.observed}: {formatDate(lookup.observed_date)} · actualizat {formatDate(lookup.updated_date)}
          </Text>
        </Card>
      )}

      <Text style={styles.h2}>{t.tabMine}</Text>
      {!user ? (
        <Button title={t.login} onPress={() => router.push('/login')} />
      ) : (
        <>
          <ErrorText>{error}</ErrorText>
          {reports.length === 0 && !error && <Text style={styles.muted}>{t.mineEmpty}</Text>}
          {reports.map((r) => (
            <Card key={r.public_id}>
              <View style={styles.row}>
                <Text style={[styles.label, { flex: 1 }]} selectable>
                  {r.public_id}
                </Text>
                <StatusBadge status={r.status} />
              </View>
              <Text style={styles.body}>{CATEGORY_LABELS[r.category] ?? r.category}</Text>
              <Text style={styles.muted}>{r.description}</Text>
              <Text style={styles.muted}>
                {t.observed}: {formatDateTime(r.observed_at)}
              </Text>
              {r.status === 'rejected' && r.rejection_reason ? (
                <Text style={[styles.body, { marginTop: 6 }]}>
                  {t.rejectedPrefix}: {REJECTION_REASON_TEXT[r.rejection_reason] ?? r.rejection_reason}
                </Text>
              ) : r.public_visibility === 'held' ? (
                <View style={[styles.row, { gap: 6, marginTop: 6 }]}>
                  <Icon name="clock" size={16} color={colors.muted} />
                  <Text style={[styles.body, { flex: 1 }]}>{t.held}</Text>
                </View>
              ) : null}
              <View style={styles.row}>
                <SourceBadge simulated={r.is_simulated} verification={r.verification} />
              </View>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}
