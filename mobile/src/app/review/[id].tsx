import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LeafletMap } from '@/components/LeafletMap';
import { Badge, Button, Card, colors, ErrorText, Field, styles } from '@/components/ui';
import { api, AuditEntry, errorText, ReviewReport } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABELS, formatDateTime, STATUS_COLORS, STATUS_LABELS, t } from '@/lib/i18n';

export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, ready } = useAuth();
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([
        api<ReviewReport>(`/review/reports/${id}`, { token }),
        api<AuditEntry[]>(`/review/reports/${id}/audit`, { token }),
      ]);
      setReport(r);
      setAudit(a);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, [id, token]);

  useEffect(() => {
    if (ready) load(); // wait for the saved session, e.g. after a browser reload on this URL
  }, [load, ready]);

  const change = async (status: string) => {
    setBusy(status);
    setError('');
    try {
      await api(`/review/reports/${id}/status`, { method: 'POST', token, body: { status, notes } });
      setNotes('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const markers = useMemo(
    () =>
      report
        ? [{ id: report.public_id, lat: report.lat, lon: report.lon, color: STATUS_COLORS[report.status], popupLines: [report.public_id] }]
        : [],
    [report],
  );

  if (!report) {
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorText>{error}</ErrorText>
        {!error && <Text style={styles.muted}>{t.loading}</Text>}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>{report.public_id}</Text>
      <View style={styles.row}>
        <Badge text={STATUS_LABELS[report.status] ?? report.status} color={STATUS_COLORS[report.status] ?? colors.muted} />
        <Badge text={report.is_simulated ? t.sourceSimulated : t.sourceUserReport} color={colors.muted} />
      </View>

      <Card>
        <Text style={styles.label}>{CATEGORY_LABELS[report.category] ?? report.category}</Text>
        {/* User text is shown as-is (untrusted data, plain text only). */}
        <Text style={styles.body} selectable>
          {report.description}
        </Text>
        <Text style={[styles.muted, { marginTop: 8 }]}>
          {t.observed}: {formatDateTime(report.observed_at)}
        </Text>
        <Text style={styles.muted}>
          {t.created}: {formatDateTime(report.created_at)}
        </Text>
        <Text style={styles.muted}>
          {report.location_source === 'gps' ? t.gps : t.pin}: {report.lat.toFixed(5)}, {report.lon.toFixed(5)}
          {report.gps_accuracy_m ? ` (±${Math.round(report.gps_accuracy_m)} m)` : ''}
        </Text>
        <Text style={styles.muted}>
          {t.reporterRef}: {report.reporter_ref}
        </Text>
      </Card>

      <LeafletMap
        style={{ height: 220, borderRadius: 8 }}
        markers={markers}
        center={{ lat: report.lat, lon: report.lon, zoom: 17 }}
      />

      <Text style={styles.h2}>{t.changeStatus}</Text>
      <Field label={t.notes} value={notes} onChangeText={setNotes} maxLength={500} multiline />
      {report.allowed_next.map((s) => (
        <Button key={s} title={`→ ${STATUS_LABELS[s] ?? s}`} variant="secondary" onPress={() => change(s)} loading={busy === s} disabled={!!busy} />
      ))}
      <ErrorText>{error}</ErrorText>

      <Text style={styles.h2}>{t.audit}</Text>
      {audit.length === 0 && <Text style={styles.muted}>{t.auditEmpty}</Text>}
      {audit.map((a) => (
        <Card key={a.id}>
          <Text style={styles.body}>
            {STATUS_LABELS[a.from_status ?? ''] ?? a.from_status} → {STATUS_LABELS[a.to_status ?? ''] ?? a.to_status}
          </Text>
          <Text style={styles.muted}>
            {formatDateTime(a.created_at)} · {a.reviewer_email}
          </Text>
          {a.notes ? <Text style={styles.muted}>„{a.notes}”</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}
