import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { EmergencyStop } from '@/components/EmergencyStop';
import { LeafletMap } from '@/components/LeafletMap';
import { ObservedAtField } from '@/components/ObservedAtField';
import { Button, Card, Chip, ErrorText, Field, Label, SourceBadge, useStyles } from '@/components/ui';
import { api, ApiError, errorText, OwnReport } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABELS, EMERGENCY_CATEGORY, EMERGENCY_CATEGORY_LABEL, t } from '@/lib/i18n';
import { needsEmergencyStop } from '@/lib/safety';

type Pick = { lat: number; lon: number; source: 'pin' | 'gps'; accuracy?: number };

export default function ReportScreen() {
  const { user, token, sessionEnded } = useAuth();
  const styles = useStyles();
  const [danger, setDanger] = useState<boolean | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [description, setDescription] = useState('');
  const [observedAt, setObservedAt] = useState(new Date());
  const [stopped, setStopped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number; zoom: number } | undefined>();
  const [result, setResult] = useState<OwnReport | null>(null);
  const [mapLocked, setMapLocked] = useState(false); // two fingers on the map: the form stops scrolling

  const reset = (keepPastIncident = false) => {
    // Nothing from a stopped submission is kept, including the description.
    setDanger(keepPastIncident ? false : null);
    setCategory(keepPastIncident ? 'incident_trecut' : null);
    setDescription('');
    setPick(null);
    setObservedAt(new Date());
    setStopped(false);
    setError('');
    setResult(null);
  };

  const gate = (next: { category?: string | null; description?: string; immediateDanger?: boolean | null }) => {
    const stop = needsEmergencyStop({
      category: next.category ?? category,
      description: next.description ?? description,
      immediateDanger: next.immediateDanger ?? danger,
    });
    if (stop) setStopped(true);
    return stop;
  };

  const useGps = async () => {
    setGpsBusy(true);
    setError('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError(t.gpsDenied);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setPick({ ...p, source: 'gps', accuracy: pos.coords.accuracy ?? undefined });
      setMapCenter({ ...p, zoom: 17 });
    } catch {
      setError(t.gpsFailed);
    } finally {
      setGpsBusy(false);
    }
  };

  const submit = async () => {
    if (gate({})) return;
    if (!pick || !category) return;
    setBusy(true);
    setError('');
    try {
      const created = await api<OwnReport>('/reports', {
        method: 'POST',
        token,
        body: {
          category,
          description: description.trim(),
          lat: pick.lat,
          lon: pick.lon,
          location_source: pick.source,
          gps_accuracy_m: pick.accuracy ?? null,
          observed_at: observedAt.toISOString(),
          immediate_danger: false,
        },
      });
      setResult(created);
    } catch (e) {
      if (e instanceof ApiError && e.detail.code === 'call_112') setStopped(true);
      // 401: AuthProvider has signed out and the login card explains it; the form keeps its contents.
      else if (e instanceof ApiError && e.status === 401) setError('');
      else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (stopped) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmergencyStop onPastIncident={() => reset(true)} onBack={() => reset()} />
      </ScrollView>
    );
  }

  if (result) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.h1}>{t.submitted}</Text>
          <Text style={styles.muted}>{t.reportId}</Text>
          <Text selectable style={[styles.h1, { letterSpacing: 1 }]}>{result.public_id}</Text>
          <SourceBadge simulated={false} />
          <Text style={[styles.body, { marginTop: 12 }]}>{t.submittedBody}</Text>
        </Card>
        <Button title={t.newReport} onPress={() => reset()} />
        <Button title={t.tabMine} variant="secondary" onPress={() => router.push('/mine')} />
      </ScrollView>
    );
  }

  const canSubmit = danger === false && !!category && !!pick && description.trim().length >= 10 && !!user;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!mapLocked}
    >
      {/* Step 1: the 112 question comes first and is available without an account. */}
      <Card>
        <Label>{t.dangerQuestion}</Label>
        <View style={styles.chips}>
          <Chip
            label={t.yes}
            selected={danger === true}
            danger
            onPress={() => {
              setDanger(true);
              gate({ immediateDanger: true });
            }}
          />
          <Chip label={t.no} selected={danger === false} onPress={() => setDanger(false)} />
        </View>
      </Card>

      {danger === false && !user && (
        <Card>
          {sessionEnded && <Text style={[styles.body, { marginBottom: 8 }]}>{t.sessionEnded}</Text>}
          <Text style={styles.body}>{t.loginToReport}</Text>
          <Button title={t.login} onPress={() => router.push('/login')} />
          <Button title={t.register} variant="secondary" onPress={() => router.push('/register')} />
        </Card>
      )}

      {danger === false && user && (
        <>
          <Label>{t.category}</Label>
          <View style={styles.chips}>
            <Chip
              label={EMERGENCY_CATEGORY_LABEL}
              selected={false}
              danger
              onPress={() => gate({ category: EMERGENCY_CATEGORY })}
            />
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <Chip key={key} label={label} selected={category === key} onPress={() => setCategory(key)} />
            ))}
          </View>

          <Label>{t.location}</Label>
          <Text style={[styles.muted, { marginBottom: 6 }]}>{t.locationHint}</Text>
          <LeafletMap
            style={{ height: 260, borderRadius: 20 }}
            cooperativeGestures
            onGestureLock={setMapLocked}
            pickable
            pick={pick}
            center={mapCenter}
            onPick={(lat, lon) => setPick({ lat, lon, source: 'pin' })}
          />
          <Button title={t.useGps} variant="secondary" icon="crosshair" onPress={useGps} loading={gpsBusy} />
          {pick && (
            <Text style={styles.muted}>
              {pick.source === 'gps' ? t.gps : t.pin}: {pick.lat.toFixed(5)}, {pick.lon.toFixed(5)}
              {pick.accuracy ? ` (±${Math.round(pick.accuracy)} m)` : ''}
            </Text>
          )}

          <View style={{ height: 12 }} />
          <Field
            label={t.description}
            value={description}
            onChangeText={setDescription}
            onBlur={() => gate({ description })}
            placeholder={t.descriptionPlaceholder}
            multiline
            maxLength={1000}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
          <Text style={[styles.muted, { marginTop: -8, marginBottom: 12 }]}>{description.trim().length}/1000 (minim 10)</Text>

          <Label>{t.observedAt}</Label>
          <ObservedAtField value={observedAt} onChange={setObservedAt} />

          <Card>
            <Text style={styles.muted}>{t.privacyNote}</Text>
          </Card>
          <ErrorText>{error}</ErrorText>
          <Button title={busy ? t.submitting : t.submit} onPress={submit} disabled={!canSubmit} loading={busy} />
        </>
      )}
    </ScrollView>
  );
}
