import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LeafletMap } from '@/components/LeafletMap';
import { RejectSheet } from '@/components/RejectSheet';
import { Button, Card, ErrorText, Field, Icon, IconName, SourceBadge, StatusBadge, useStyles } from '@/components/ui';
import { api, AuditEntry, errorText, ReviewReport } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABELS, formatDateTime, REJECTION_REASON_LABELS, STATUS_LABELS, t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { StatusKey } from '@/theme';

type Action = { status: string; title: string; icon: IconName; variant: 'primary' | 'secondary' };

// The main decisions get big, plainly named buttons; the remaining transitions keep their status label.
function actionFor(current: string, next: string): Action {
  if (next === 'validated') {
    return current === 'resolved'
      ? { status: next, title: t.actReopen, icon: 'rotate-ccw', variant: 'secondary' }
      : { status: next, title: t.actValidate, icon: 'check-circle', variant: 'primary' };
  }
  if (next === 'under_review') {
    return current === 'submitted'
      ? { status: next, title: t.actUnderReview, icon: 'search', variant: 'secondary' }
      : { status: next, title: t.actReopen, icon: 'rotate-ccw', variant: 'secondary' };
  }
  if (next === 'rejected') return { status: next, title: t.actReject, icon: 'x-circle', variant: 'secondary' };
  return { status: next, title: STATUS_LABELS[next] ?? next, icon: 'arrow-right', variant: 'secondary' };
}

const ACTION_ORDER = ['validated', 'under_review', 'rejected', 'referred', 'resolved', 'expired'];

export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, ready } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [mapLocked, setMapLocked] = useState(false); // two fingers on the map: the page stops scrolling
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

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

  const startReject = () => {
    setRejectError('');
    setRejecting(true);
  };

  const reject = async (reason: string, rejectNotes: string) => {
    setBusy('rejected');
    setRejectError('');
    try {
      await api(`/review/reports/${id}/status`, { method: 'POST', token, body: { status: 'rejected', reason, notes: rejectNotes } });
      setRejecting(false);
      await load();
    } catch (e) {
      setRejectError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const actions = useMemo(
    () =>
      report
        ? [...report.allowed_next]
            .sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b))
            .map((next) => actionFor(report.status, next))
        : [],
    [report],
  );

  const markers = useMemo(
    () =>
      report
        ? [{ id: report.public_id, lat: report.lat, lon: report.lon, color: colors.status[report.status as StatusKey] ?? colors.status.submitted }]
        : [],
    [report, colors],
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!mapLocked}
    >
      <Text style={styles.h1}>{report.public_id}</Text>
      <View style={styles.row}>
        <StatusBadge status={report.status} />
        <SourceBadge simulated={report.is_simulated} verification={report.verification} />
      </View>
      {report.public_visibility === 'held' && (
        <View style={[styles.row, { gap: 6, marginTop: 6 }]}>
          <Icon name="eye-off" size={16} color={colors.muted} />
          <Text style={[styles.muted, { flex: 1 }]}>{t.heldForReview}</Text>
        </View>
      )}
      {report.rejection_reason && (
        <Text style={[styles.muted, { marginTop: 6 }]}>
          {t.reason}: {REJECTION_REASON_LABELS[report.rejection_reason] ?? report.rejection_reason}
        </Text>
      )}

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
        style={{ height: 220, borderRadius: 20 }}
        cooperativeGestures
        onGestureLock={setMapLocked}
        markers={markers}
        center={{ lat: report.lat, lon: report.lon, zoom: 17 }}
      />

      <Text style={styles.h2}>{t.changeStatus}</Text>
      <Field label={t.notes} value={notes} onChangeText={setNotes} maxLength={500} multiline />
      {actions.map((a) => (
        <Button
          key={a.status}
          title={a.title}
          icon={a.icon}
          variant={a.variant}
          onPress={() => (a.status === 'rejected' ? startReject() : change(a.status))}
          loading={busy === a.status && a.status !== 'rejected'}
          disabled={!!busy}
        />
      ))}
      <ErrorText>{error}</ErrorText>
      <RejectSheet
        visible={rejecting}
        busy={busy === 'rejected'}
        error={rejectError}
        onCancel={() => setRejecting(false)}
        onConfirm={reject}
      />

      <Text style={styles.h2}>{t.audit}</Text>
      {audit.length === 0 && <Text style={styles.muted}>{t.auditEmpty}</Text>}
      {audit.map((a) => (
        <Card key={a.id}>
          <View style={[styles.row, { gap: 6 }]}>
            <Text style={styles.body}>{STATUS_LABELS[a.from_status ?? ''] ?? a.from_status}</Text>
            <Icon name="arrow-right" size={16} color={colors.muted} />
            <Text style={styles.body}>{STATUS_LABELS[a.to_status ?? ''] ?? a.to_status}</Text>
          </View>
          <Text style={styles.muted}>
            {formatDateTime(a.created_at)} · {a.reviewer_email}
          </Text>
          {a.reason ? (
            <Text style={styles.muted}>
              {t.reason}: {REJECTION_REASON_LABELS[a.reason] ?? a.reason}
            </Text>
          ) : null}
          {a.notes ? <Text style={styles.muted}>„{a.notes}”</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}
