import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';

import { t } from '@/lib/i18n';
import { Button, Card, useStyles } from './ui';

// Stable asset name on the latest GitHub Release, so this link never needs updating.
export const APK_URL = 'https://github.com/iasi-safeflow/iasi-safeflow.github.io/releases/latest/download/iasi-safeflow.apk';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallCard() {
  const styles = useStyles();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia?.('(display-mode: standalone)').matches ?? false);
    // Chrome fires this only when the site is installable and not yet installed.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return (
    <Card>
      <Text style={styles.h2}>{t.installTitle}</Text>
      {!standalone && <Text style={styles.body}>{t.installBody}</Text>}
      {prompt && !standalone && <Button title={t.installPwa} onPress={install} />}
      <Button title={t.installApk} variant="secondary" icon="download" onPress={() => Linking.openURL(APK_URL)} />
    </Card>
  );
}
