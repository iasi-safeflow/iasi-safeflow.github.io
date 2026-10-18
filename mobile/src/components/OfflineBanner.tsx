import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { colors } from './ui';

// Shown under the 112 banner while the device has no internet. Hidden while the state is still unknown.
export function OfflineBanner() {
  const net = useNetworkState();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View style={s.bar} accessibilityRole="alert">
      <Text style={s.text}>{t.offline}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#fff4e5', borderBottomWidth: 1, borderBottomColor: '#b54708', paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: '#7a2e0e', fontSize: 13 },
});
