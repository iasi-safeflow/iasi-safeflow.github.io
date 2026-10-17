import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { EmergencyBanner } from '@/components/EmergencyBanner';
import { colors } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.dangerBg }}>
          <StatusBar style="dark" />
          {/* 112 banner sits above the navigator, so it is on every screen. */}
          <EmergencyBanner />
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'Autentificare' }} />
            <Stack.Screen name="register" options={{ title: 'Creează cont' }} />
            <Stack.Screen name="review/[id]" options={{ title: 'Detalii raport' }} />
          </Stack>
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
