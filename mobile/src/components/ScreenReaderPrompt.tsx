import { useEffect, useRef } from 'react';
import { Modal, View } from 'react-native';

import { focusOn } from '@/lib/a11y';
import { shouldSuggestScreenReaderMode } from '@/lib/a11yPrefs';
import { useA11y } from '@/lib/a11ySettings';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { radius } from '@/theme';
import { Text } from './AppText';
import { Button, Heading, useStyles } from './ui';

// Asked once, when TalkBack/VoiceOver is running and the simplified mode is off. The answer is saved and the
// question never comes back; the switch stays in Cont → Accesibilitate. (Browsers never report a screen reader,
// so on the web the mode is only switched on by hand.)
export function ScreenReaderPrompt() {
  const { prefs, ready, update, screenReaderRunning } = useA11y();
  const { colors } = useTheme();
  const styles = useStyles();
  const heading = useRef(null);
  const visible = ready && shouldSuggestScreenReaderMode(prefs, screenReaderRunning);

  useEffect(() => {
    if (visible) focusOn(heading);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => update({ srPromptAnswered: true })}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.shadow }}>
        <View
          accessibilityViewIsModal
          role="dialog"
          aria-modal
          style={{ backgroundColor: colors.card, borderRadius: radius.card, borderWidth: colors.lineWidth, borderColor: colors.border, padding: 20 }}
        >
          <Heading ref={heading} level={2} style={{ marginTop: 0 }}>
            {t.srPrompt}
          </Heading>
          <Text style={[styles.muted, { marginBottom: 8 }]}>{t.srModeHint}</Text>
          <Button title={t.srPromptYes} onPress={() => update({ srPromptAnswered: true, screenReaderMode: true })} />
          <Button title={t.srPromptNo} variant="secondary" onPress={() => update({ srPromptAnswered: true })} />
          <Text style={[styles.muted, { marginTop: 8 }]}>{t.srPromptLater}</Text>
        </View>
      </View>
    </Modal>
  );
}
