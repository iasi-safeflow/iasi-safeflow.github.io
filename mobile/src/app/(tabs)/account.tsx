import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { InstallCard } from '@/components/InstallCard';
import { Button, Card, Chip, Label, useStyles } from '@/components/ui';
import { API_URL } from '@/lib/api';
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
        <View style={styles.chips} accessibilityRole="radiogroup">
          {THEME_OPTIONS.map(([value, label]) => (
            <Chip key={value} label={label} selected={mode === value} onPress={() => setMode(value)} />
          ))}
        </View>
      </Card>
      <InstallCard />
      <Text style={styles.h2}>Despre SafeFlow</Text>
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
      <Text style={styles.muted}>
        Prioritatea de analiză a rapoartelor este sugerată automat (reguli și similaritate de text); decizia aparține
        unui recenzent. Aplicația nu evaluează urgențe: pentru urgențe sunați la 112.
      </Text>
    </ScrollView>
  );
}
