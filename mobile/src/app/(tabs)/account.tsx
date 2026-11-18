import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/AppText';
import { InstallCard } from '@/components/InstallCard';
import { Button, Card, Chip, Heading, Label, SettingSwitch, useStyles } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useA11y } from '@/lib/a11ySettings';
import { useAuth } from '@/lib/auth';
import { formatDateTime, t } from '@/lib/i18n';
import { ThemeMode, useTheme } from '@/lib/themeMode';

const THEME_OPTIONS: [ThemeMode, string][] = [
  ['auto', t.themeAuto],
  ['light', t.themeLight],
  ['dark', t.themeDark],
];

export default function AccountScreen() {
  const { user, points, logout, refreshPoints } = useAuth();
  const { mode, setMode, colors } = useTheme();
  const { prefs, update, feedback } = useA11y();
  const styles = useStyles();

  useFocusEffect(
    useCallback(() => {
      if (user) void refreshPoints();
    }, [user, refreshPoints]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {user ? (
        <>
          <Card>
            <Text style={styles.body}>{user.email}</Text>
            <Text style={styles.muted}>{user.role === 'reviewer' ? t.roleReviewer : t.roleReporter}</Text>
            <Button title={t.logout} variant="secondary" icon="log-out" onPress={logout} />
          </Card>
          {points && (
            <Card>
              <View style={[styles.row, { gap: 8, marginBottom: 6 }]}>
                <Heading level={2} style={{ marginTop: 0, marginBottom: 0, flex: 1 }}>
                  {t.pointsTitle}
                </Heading>
                <View style={[styles.badge, { backgroundColor: colors.primarySoft, marginTop: 0 }]}>
                  <Text style={[styles.badgeText, { color: colors.primarySoftText }]}>{points.level}</Text>
                </View>
              </View>
              <Text style={styles.label}>{t.pointsBalance.replace('{n}', String(points.balance))}</Text>
              <Text style={styles.muted}>{t.pointsEarned.replace('{n}', String(points.earned))}</Text>
              <Text style={[styles.body, { marginTop: 6 }]}>
                {points.trusted
                  ? t.trustedActive
                  : t.trustedProgress.replace('{n}', String(Math.max(0, points.trusted_threshold - points.earned)))}
              </Text>
              <Text style={[styles.muted, { marginTop: 6 }]}>{t.pointsHowBody}</Text>
              <Text style={[styles.label, { marginTop: 10 }]}>{t.pointsHistoryTitle}</Text>
              {points.history.length === 0 ? (
                <Text style={styles.muted}>{t.pointsHistoryEmpty}</Text>
              ) : (
                points.history.slice(0, 8).map((ev) => (
                  <View
                    key={ev.id}
                    style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 3 }}
                  >
                    <Text
                      style={{
                        fontFamily: styles.label.fontFamily,
                        color: ev.delta >= 0 ? colors.primarySoftText : colors.alertText,
                        width: 46,
                      }}
                    >
                      {ev.delta >= 0 ? `+${ev.delta}` : ev.delta}
                    </Text>
                    <Text style={[styles.muted, { flex: 1 }]}>
                      {ev.description} · {formatDateTime(ev.created_at)}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          )}
        </>
      ) : (
        <>
          <Button title={t.login} icon="log-in" onPress={() => router.push('/login')} />
          <Button title={t.register} variant="secondary" onPress={() => router.push('/register')} />
        </>
      )}
      <Card style={{ marginTop: 8 }}>
        <Label>{t.theme}</Label>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t.theme}>
          {THEME_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={mode === value} onPress={() => setMode(value)} />
          ))}
        </View>
      </Card>
      <Card>
        <Heading level={2} style={{ marginTop: 0 }}>
          {t.a11yTitle}
        </Heading>
        <SettingSwitch
          label={t.srModeLabel}
          hint={t.srModeHint}
          value={prefs.screenReaderMode}
          onChange={(v) => update({ screenReaderMode: v, srPromptAnswered: true })}
        />
        <SettingSwitch label={t.largeTextLabel} hint={t.largeTextHint} value={prefs.largeText} onChange={(v) => update({ largeText: v })} />
        <SettingSwitch
          label={t.highContrastLabel}
          hint={t.highContrastHint}
          value={prefs.highContrast}
          onChange={(v) => update({ highContrast: v })}
        />
        <SettingSwitch label={t.feedbackLabel} hint={t.feedbackHint} value={feedback} onChange={(v) => update({ feedback: v })} />
        <Text style={[styles.muted, { marginTop: 8 }]}>{t.streetPrivacy}</Text>
      </Card>
      <InstallCard />
      <Heading level={2}>Despre SafeFlow</Heading>
      <Text style={styles.body}>
        Iași SafeFlow este un prototip pentru semnalarea problemelor de siguranță rutieră non-urgente. Un raport este o
        observație, nu o dovadă că locul cauzează accidente. Aplicația nu este un serviciu de urgență și nu contactează
        112, poliția sau alte autorități.
      </Text>
      <Text style={[styles.muted, { marginTop: 16 }]}>
        {t.appVersion}: {Constants.expoConfig?.version ?? '?'}
      </Text>
      <Text style={styles.muted}>Server API: {API_URL}</Text>
      <Text style={styles.muted}>Hartă: © contribuitorii OpenStreetMap, Leaflet.</Text>
      <Text style={styles.muted}>{t.osmAttribution}</Text>
      <Text style={styles.muted}>
        Prioritatea de analiză a rapoartelor este sugerată automat (reguli și similaritate de text); decizia aparține
        unui recenzent. Aplicația nu evaluează urgențe: pentru urgențe sunați la 112.
      </Text>
    </ScrollView>
  );
}
