// Per-weight imports: the package root would bundle all 16 Nunito files.
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { EmergencyBanner } from '@/components/EmergencyBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/themeMode';
import { fonts } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          {/* If the font fails to load, the system font is used rather than blocking the app (and the 112 bar). */}
          <Shell ready={fontsLoaded || !!fontError} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Shell({ ready }: { ready: boolean }) {
  const { colors, dark } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* The 112 bar is on every screen: here above the navigator, and on the home screen below its greeting. */}
      {pathname !== '/' && <EmergencyBanner />}
      <OfflineBanner />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.extrabold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Autentificare' }} />
        <Stack.Screen name="register" options={{ title: 'Creează cont' }} />
        <Stack.Screen name="review/[id]" options={{ title: 'Detalii raport' }} />
      </Stack>
    </SafeAreaView>
  );
}
