import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { REJECTION_REASON_LABELS, t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { radius } from '@/theme';
import { Button, Chip, ErrorText, Field, useStyles } from './ui';

// Bottom sheet for rejecting a report: a reason is required, the note is optional and stays private to reviewers.
export function RejectSheet({
  visible,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (reason: string, notes: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNotes('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel={t.cancel} onPress={onCancel} style={{ flex: 1, backgroundColor: colors.shadow }} />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: '85%',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.h2}>{t.rejectTitle}</Text>
            <Text style={[styles.muted, { marginBottom: 12 }]}>{t.rejectHint}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {Object.entries(REJECTION_REASON_LABELS).map(([key, label]) => (
                <Chip key={key} label={label} selected={reason === key} onPress={() => setReason(key)} />
              ))}
            </View>
            <Field label={t.rejectNote} value={notes} onChangeText={setNotes} maxLength={500} multiline />
            <ErrorText>{error}</ErrorText>
            <Button
              title={t.rejectConfirm}
              icon="x-circle"
              onPress={() => reason && onConfirm(reason, notes)}
              disabled={!reason}
              loading={busy}
            />
            <Button title={t.cancel} variant="secondary" onPress={onCancel} disabled={busy} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
