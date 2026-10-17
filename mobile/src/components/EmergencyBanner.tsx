import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { colors } from './ui';

// Shown above every screen by the root layout. Tapping only opens the phone dialer; the app never calls or notifies anyone.
export function EmergencyBanner() {
  return (
    <View style={s.bar} accessibilityRole="alert">
      <Text style={s.text}>{t.banner}</Text>
      <Pressable accessibilityRole="button" onPress={() => Linking.openURL('tel:112')} style={s.call}>
        <Text style={s.callText}>{t.bannerCall}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600' },
  call: { backgroundColor: colors.danger, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  callText: { color: '#fff', fontWeight: '700' },
});
