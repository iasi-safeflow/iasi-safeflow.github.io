import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts } from '@/theme';
import { Icon } from './ui';

// Shown under the 112 banner while the device has no internet. Hidden while the state is still unknown.
export function OfflineBanner() {
  const { colors } = useTheme();
  const net = useNetworkState();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;
  const warn = colors.statusSoft.under_review;
  return (
    <View style={[s.bar, { backgroundColor: warn.bg }]} accessibilityRole="alert">
      <Icon name="wifi-off" size={18} color={warn.text} />
      <Text style={[s.text, { color: warn.text }]}>{t.offline}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, marginHorizontal: 16, marginVertical: 4, paddingHorizontal: 14, paddingVertical: 10 },
  text: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
});
