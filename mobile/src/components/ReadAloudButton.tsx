import { useEffect, useState } from 'react';

import { useA11y } from '@/lib/a11ySettings';
import { speak, stopSpeaking } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { Button } from './ui';

// "Citește cu voce tare": reads the given text with the phone's built-in voice. Hidden while TalkBack/VoiceOver
// is running, so the content is never spoken twice at once.
export function ReadAloudButton({ text }: { text: string }) {
  const { screenReaderRunning } = useA11y();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => stopSpeaking(), []);

  if (screenReaderRunning) return null;
  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    void speak(text, () => setSpeaking(false));
  };
  return (
    <Button
      title={speaking ? t.readAloudStop : t.readAloud}
      icon={speaking ? 'square' : 'volume-2'}
      variant="secondary"
      accessibilityHint={t.readAloudHint}
      onPress={toggle}
    />
  );
}
