import { Linking, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { EMERGENCY_MESSAGE } from '@/lib/safety';
import { useTheme } from '@/lib/themeMode';
import { fonts } from '@/theme';
import { Button, Icon, useStyles } from './ui';

// Replaces the report form. Nothing typed so far is stored, queued or sent. Kept prominent and clearly red.
export function EmergencyStop({ onPastIncident, onBack }: { onPastIncident: () => void; onBack: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.card, { borderColor: colors.alertButton, borderWidth: 2, backgroundColor: colors.alertBg }]} accessibilityRole="alert">
      <View style={[styles.row, { gap: 10, marginBottom: 8 }]}>
        <Icon name="alert-octagon" size={32} color={colors.alertText} />
        <Text style={[styles.h1, { color: colors.alertText, marginBottom: 0, flex: 1 }]}>{t.emergencyTitle}</Text>
      </View>
      <Text style={{ fontFamily: fonts.black, fontSize: 20, lineHeight: 27, color: colors.alertText, marginBottom: 16 }}>
        {EMERGENCY_MESSAGE}
      </Text>
      <Button title={t.bannerCall} variant="danger" icon="phone" onPress={() => Linking.openURL('tel:112')} />
      <Text style={[styles.muted, { color: colors.alertText, marginTop: 16, marginBottom: 8 }]}>{t.emergencyPastHint}</Text>
      <Button title={t.emergencyPastButton} variant="secondary" onPress={onPastIncident} />
      <Button title={t.emergencyBack} variant="secondary" onPress={onBack} />
    </View>
  );
}
