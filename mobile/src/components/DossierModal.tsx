import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/AppText';
import { DossierOut } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius } from '@/theme';
import { copyDossier, downloadDossier, isWebDossier, printDossier, shareDossier } from './DossierSave';
import { Button, ErrorText, Heading, useStyles } from './ui';

// Preview + export modal for a validated/referred/resolved report's formal municipal referral dossier.
export function DossierModal({
  dossier,
  onClose,
}: {
  dossier: DossierOut | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');

  if (!dossier) return null;

  const doCopy = async () => {
    setErr('');
    try {
      if (await copyDossier(dossier.text)) setNotice(t.dossierCopied);
      else setErr(t.genericError);
    } catch {
      setErr(t.genericError);
    }
  };

  const doShare = async () => {
    setErr('');
    try {
      await shareDossier(dossier);
    } catch {
      setErr(t.genericError);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel={t.dossierClose} onPress={onClose} style={{ flex: 1, backgroundColor: colors.shadow }} />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            borderWidth: colors.lineWidth,
            borderColor: colors.border,
            maxHeight: '88%',
            padding: 18,
          }}
        >
          <Heading level={2} style={{ marginTop: 0 }}>
            {t.dossierTitle} · {dossier.public_id}
          </Heading>
          <View style={{ backgroundColor: colors.alertBg, borderRadius: 12, padding: 10, marginBottom: 10 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.alertText }}>{dossier.disclaimer}</Text>
          </View>
          <ScrollView
            style={{
              borderWidth: colors.lineWidth,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.bg,
              padding: 12,
              maxHeight: 280,
              marginBottom: 10,
            }}
          >
            <Text selectable style={[styles.body, { fontSize: 14, lineHeight: 20 }]}>
              {dossier.text}
            </Text>
          </ScrollView>
          {notice ? <Text style={[styles.muted, { color: colors.primarySoftText, marginBottom: 6 }]}>{notice}</Text> : null}
          <ErrorText>{err}</ErrorText>
          {isWebDossier ? (
            <>
              <Button title={t.dossierPrintPdf} icon="printer" onPress={() => printDossier(dossier.html)} />
              <Button title={t.dossierCopy} icon="copy" variant="secondary" onPress={doCopy} />
              <Button
                title={t.dossierDownloadTxt}
                icon="download"
                variant="secondary"
                onPress={() => downloadDossier(dossier.public_id, dossier.text)}
              />
            </>
          ) : (
            <Button title={t.dossierShare} icon="share-2" onPress={doShare} />
          )}
          <Button title={t.dossierClose} variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
