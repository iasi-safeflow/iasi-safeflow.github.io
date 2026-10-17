import { Linking, Text, View } from 'react-native';

import { t } from '@/lib/i18n';
import { EMERGENCY_MESSAGE } from '@/lib/safety';
import { Button, colors, styles } from './ui';

// Replaces the report form. Nothing typed so far is stored, queued or sent.
export function EmergencyStop({ onPastIncident, onBack }: { onPastIncident: () => void; onBack: () => void }) {
  return (
    <View style={[styles.card, { borderColor: colors.danger, backgroundColor: colors.dangerBg }]} accessibilityRole="alert">
      <Text style={[styles.h1, { color: colors.danger }]}>{t.emergencyTitle}</Text>
      <Text style={[styles.body, { fontSize: 18, fontWeight: '700', color: colors.danger, marginBottom: 16 }]}>
        {EMERGENCY_MESSAGE}
      </Text>
      <Button title={t.bannerCall} variant="danger" onPress={() => Linking.openURL('tel:112')} />
      <Text style={[styles.muted, { marginTop: 16, marginBottom: 8 }]}>{t.emergencyPastHint}</Text>
      <Button title={t.emergencyPastButton} variant="secondary" onPress={onPastIncident} />
      <Button title={t.emergencyBack} variant="secondary" onPress={onBack} />
    </View>
  );
}
