import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, TOUCH } from '@/theme';
import { Icon } from './ui';

// On every screen (root layout, or below the greeting on the home screen). Tapping only opens the phone dialer;
// the app never calls or notifies anyone.
export function EmergencyBanner() {
  const { colors } = useTheme();
  return (
    <View style={[s.bar, { backgroundColor: colors.alertBg }]} accessibilityRole="alert">
      <Icon name="alert-triangle" size={20} color={colors.alertText} />
      <Text style={[s.text, { color: colors.alertText }]}>{t.banner}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.bannerCall}
        onPress={() => Linking.openURL('tel:112')}
        style={({ pressed }) => [s.call, { backgroundColor: colors.alertButton, opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon name="phone" size={16} color={colors.onAlertButton} />
        <Text style={[s.callText, { color: colors.onAlertButton }]}>{t.bannerCall}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
  },
  text: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  callText: { fontFamily: fonts.black, fontSize: 15 },
});
