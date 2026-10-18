import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { announce, focusOn } from '@/lib/a11y';
import { api } from '@/lib/api';
import { CATEGORY_LABELS, EMERGENCY_CATEGORY, EMERGENCY_CATEGORY_LABEL, formatDateTime, joinSentences, t } from '@/lib/i18n';
import { Text } from './AppText';
import { ObservedAtField } from './ObservedAtField';
import { ReadAloudButton } from './ReadAloudButton';
import { Button, Card, Chip, ErrorText, Field, Heading, useStyles } from './ui';

// The report form for the screen-reader mode: one question per screen, "Pasul X din 5" read on every step, and the
// location from GPS by default (read back with the nearest street when known). It shares its state, the 112 gate
// and the submission with the regular form in app/(tabs)/report.tsx.

export type StepPick = { lat: number; lon: number; source: 'pin' | 'gps'; accuracy?: number; label?: string };

type Gate = (next: { category?: string | null; description?: string; immediateDanger?: boolean | null }) => boolean;

export type ReportStepsProps = {
  token: string | null;
  signedIn: boolean;
  sessionEnded: boolean;
  danger: boolean | null;
  setDanger: (v: boolean) => void;
  category: string | null;
  setCategory: (v: string) => void;
  pick: StepPick | null;
  setPick: (p: StepPick | null) => void;
  description: string;
  setDescription: (v: string) => void;
  observedAt: Date;
  setObservedAt: (d: Date) => void;
  gate: Gate;
  submit: () => void;
  busy: boolean;
  error: string;
};

const TITLES = [t.stepSafety, t.stepCategory, t.stepLocation, t.stepDescription, t.stepReview];

export function ReportSteps(p: ReportStepsProps) {
  const styles = useStyles();
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState('');
  const heading = useRef(null);

  // Each new step is announced through its heading, which receives focus.
  useEffect(() => {
    setStepError('');
    focusOn(heading);
  }, [step]);

  const go = (n: number) => setStep(n);
  const title = `${t.stepOf.replace('{x}', String(step))}: ${TITLES[step - 1]}`;

  const nextFromCategory = () => (p.category ? go(3) : setStepError(t.needCategory));
  const nextFromLocation = () => (p.pick ? go(4) : setStepError(t.needLocation));
  const nextFromDescription = () => {
    if (p.gate({ description: p.description })) return;
    if (p.description.trim().length < 10) setStepError(t.needDescription);
    else go(5);
  };

  return (
    <View>
      <Heading ref={heading}>{title}</Heading>

      {step === 1 && (
        <>
          <Card>
            <Text style={styles.label}>{t.dangerQuestion}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={t.dangerQuestion}>
              <Chip
                label={t.yes}
                selected={p.danger === true}
                danger
                onPress={() => {
                  p.setDanger(true);
                  p.gate({ immediateDanger: true });
                }}
              />
              <Chip label={t.no} selected={p.danger === false} onPress={() => p.setDanger(false)} />
            </View>
          </Card>
          {p.danger === false && !p.signedIn ? (
            <Card>
              {p.sessionEnded && <Text style={[styles.body, { marginBottom: 8 }]}>{t.sessionEnded}</Text>}
              <Text style={styles.body}>{t.loginToReport}</Text>
              <Button title={t.login} onPress={() => router.push('/login')} />
              <Button title={t.register} variant="secondary" onPress={() => router.push('/register')} />
            </Card>
          ) : (
            <Button title={t.next} icon="arrow-right" onPress={() => go(2)} disabled={p.danger !== false} />
          )}
        </>
      )}

      {step === 2 && (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel={t.category}>
            <Chip
              label={EMERGENCY_CATEGORY_LABEL}
              selected={false}
              danger
              accessibilityHint={t.emergencyCategoryHint}
              onPress={() => p.gate({ category: EMERGENCY_CATEGORY })}
            />
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <Chip key={key} label={label} selected={p.category === key} onPress={() => p.setCategory(key)} />
            ))}
          </View>
          <ErrorText>{stepError}</ErrorText>
          <Button title={t.next} icon="arrow-right" onPress={nextFromCategory} />
          <Button title={t.back} variant="secondary" onPress={() => go(1)} />
        </>
      )}

      {step === 3 && (
        <>
          <LocationStep token={p.token} pick={p.pick} setPick={p.setPick} />
          <ErrorText>{stepError}</ErrorText>
          <Button title={t.next} icon="arrow-right" onPress={nextFromLocation} />
          <Button title={t.back} variant="secondary" onPress={() => go(2)} />
        </>
      )}

      {step === 4 && (
        <>
          <Field
            label={t.description}
            value={p.description}
            onChangeText={p.setDescription}
            onBlur={() => p.gate({ description: p.description })}
            placeholder={t.descriptionPlaceholder}
            hint={t.dictationHint}
            multiline
            maxLength={1000}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <Text style={[styles.muted, { marginBottom: 12 }]} accessibilityLabel={t.charCount.replace('{n}', String(p.description.trim().length))}>
            {p.description.trim().length}/1000 (minim 10)
          </Text>
          <Text style={styles.label}>{t.observedAt}</Text>
          <ObservedAtField value={p.observedAt} onChange={p.setObservedAt} />
          <ErrorText>{stepError}</ErrorText>
          <Button title={t.next} icon="arrow-right" onPress={nextFromDescription} />
          <Button title={t.back} variant="secondary" onPress={() => go(3)} />
        </>
      )}

      {step === 5 && <ReviewStep {...p} onBack={() => go(4)} />}
    </View>
  );
}

function pickText(pick: StepPick): string {
  if (pick.label) return pick.label;
  return pick.accuracy ? `${t.gpsLocation} (±${Math.round(pick.accuracy)} m)` : t.gpsLocation;
}

function ReviewStep(p: ReportStepsProps & { onBack: () => void }) {
  const styles = useStyles();
  const lines = [
    t.summaryDanger,
    `${t.summaryCategory}: ${p.category ? (CATEGORY_LABELS[p.category] ?? p.category) : ''}`,
    `${t.summaryLocation}: ${p.pick ? pickText(p.pick) : ''}`,
    `${t.summaryDescription}: ${p.description.trim()}`,
    `${t.summaryObserved}: ${formatDateTime(p.observedAt.toISOString())}`,
  ];
  const spoken = joinSentences(lines);
  // The summary is read out once when the step opens, before the "Trimite" button.
  useEffect(() => {
    announce(spoken);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Card label={spoken}>
        {lines.map((l) => (
          <Text key={l} style={styles.body}>
            {l}
          </Text>
        ))}
      </Card>
      <ReadAloudButton text={spoken} />
      <Card>
        <Text style={styles.muted}>{t.privacyNote}</Text>
      </Card>
      <ErrorText>{p.error}</ErrorText>
      <Button title={p.busy ? t.submitting : t.submit} onPress={p.submit} loading={p.busy} disabled={!p.signedIn} />
      <Button title={t.back} variant="secondary" onPress={p.onBack} disabled={p.busy} />
    </>
  );
}

type SearchResult = { label: string; lat: number; lon: number };

// GPS first, read back with the nearest street; "Folosește altă locație" searches a typed street name, only when
// the user presses "Caută" (the street-name service must not be queried while typing).
function LocationStep({ token, pick, setPick }: { token: string | null; pick: StepPick | null; setPick: (p: StepPick | null) => void }) {
  const styles = useStyles();
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState('');

  const say = (text: string) => {
    setStatus(text);
    announce(text);
  };

  const locate = async () => {
    setLocating(true);
    setError('');
    say(t.locating);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setStatus('');
        setError(t.gpsDenied);
        setShowSearch(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const point = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const accuracy = pos.coords.accuracy ?? undefined;
      let street: string | null = null;
      try {
        const r = await api<{ street: string | null }>(`/geo/reverse?lat=${point.lat}&lon=${point.lon}`, { token });
        street = r.street;
      } catch {
        street = null; // no street name: distance and accuracy are still read out
      }
      setPick({ ...point, source: 'gps', accuracy, label: street ? `${street} (${t.gpsLocation})` : undefined });
      const m = accuracy ? String(Math.round(accuracy)) : null;
      say(
        street && m
          ? t.locationNear.replace('{street}', street).replace('{m}', m)
          : m
            ? t.locationAccuracy.replace('{m}', m)
            : t.locationSetPlain,
      );
    } catch {
      setStatus('');
      setError(t.gpsFailed);
      setShowSearch(true);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!pick) void locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async () => {
    setSearching(true);
    setError('');
    setResults(null);
    try {
      const r = await api<{ available: boolean; results: SearchResult[] }>(`/geo/search?q=${encodeURIComponent(query.trim())}`, { token });
      if (!r.available) setError(t.streetUnavailable);
      else {
        setResults(r.results);
        announce(r.results.length ? `${r.results.length} rezultate.` : t.streetNoResults);
      }
    } catch {
      setError(t.streetUnavailable);
    } finally {
      setSearching(false);
    }
  };

  return (
    <View>
      {status ? (
        <Card>
          <Text style={styles.body}>{status}</Text>
        </Card>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button title={t.tryAgain} icon="crosshair" variant="secondary" onPress={locate} loading={locating} />
      <Button title={t.otherLocation} icon="search" variant="secondary" onPress={() => setShowSearch(true)} />
      {showSearch && (
        <Card>
          <Field label={t.streetSearchLabel} value={query} onChangeText={setQuery} hint={t.streetSearchHint} maxLength={100} />
          <Button title={t.streetSearch} icon="search" onPress={search} loading={searching} disabled={query.trim().length < 3} />
          {results && results.length === 0 && <Text style={styles.muted}>{t.streetNoResults}</Text>}
          {results && results.length > 0 && (
            <View accessibilityRole="radiogroup" accessibilityLabel={t.streetSearchLabel}>
              {results.map((r) => (
                <Chip
                  key={`${r.lat},${r.lon}`}
                  label={r.label}
                  selected={!!pick && pick.lat === r.lat && pick.lon === r.lon}
                  onPress={() => {
                    setPick({ lat: r.lat, lon: r.lon, source: 'pin', label: r.label });
                    say(t.locationChosen.replace('{label}', r.label));
                  }}
                />
              ))}
            </View>
          )}
        </Card>
      )}
      <Text style={[styles.muted, { marginTop: 8 }]}>{t.streetPrivacy}</Text>
      <Text style={styles.muted}>{t.osmAttribution}</Text>
    </View>
  );
}
