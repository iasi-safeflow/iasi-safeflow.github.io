import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Button, Card, styles } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';

export default function AccountScreen() {
  const { user, logout } = useAuth();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {user ? (
        <Card>
          <Text style={styles.body}>{user.email}</Text>
          <Text style={styles.muted}>{user.role === 'reviewer' ? t.roleReviewer : t.roleReporter}</Text>
          <Button title={t.logout} variant="secondary" onPress={logout} />
        </Card>
      ) : (
        <>
          <Button title={t.login} onPress={() => router.push('/login')} />
          <Button title={t.register} variant="secondary" onPress={() => router.push('/register')} />
        </>
      )}
      <Text style={styles.h2}>Despre SafeFlow</Text>
      <Text style={styles.body}>
        Iași SafeFlow este un prototip pentru semnalarea problemelor de siguranță rutieră non-urgente. Un raport este o
        observație, nu o dovadă că locul cauzează accidente. Aplicația nu este un serviciu de urgență și nu contactează
        112, poliția sau alte autorități.
      </Text>
      <Text style={[styles.muted, { marginTop: 16 }]}>Server API: {API_URL}</Text>
      <Text style={styles.muted}>Hartă: © contribuitorii OpenStreetMap, Leaflet.</Text>
    </ScrollView>
  );
}
