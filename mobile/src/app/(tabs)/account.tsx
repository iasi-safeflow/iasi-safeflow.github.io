import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/AppText';
import { InstallCard } from '@/components/InstallCard';
import { Button, Card, Chip, Heading, Label, SettingSwitch, useStyles } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useA11y } from '@/lib/a11ySettings';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { ThemeMode, useTheme } from '@/lib/themeMode';

const THEME_OPTIONS: [ThemeMode, string][] = [
  ['auto', t.themeAuto],
  ['light', t.themeLight],
  ['dark', t.themeDark],
];

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { prefs, update, feedback } = useA11y();
  const styles = useStyles();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {user ? (
        <Card>
          <Text style={styles.body}>{user.email}</Text>
          <Text style={styles.muted}>{user.role === 'reviewer' ? t.roleReviewer : t.roleReporter}</Text>
          <Button title={t.logout} variant="secondary" icon="log-out" onPress={logout} />
        </Card>
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
