import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useCallback } from 'react';

import { useA11y } from './a11ySettings';

// Short vibrations ("Vibrații și sunete" in Cont → Accesibilitate; on by default in the screen-reader mode).
// No sounds: those would need audio files and another native module.
export type FeedbackKind = 'success' | 'warning' | 'strong';

export function useHaptics() {
  const { feedback } = useA11y();
  return useCallback(
    (kind: FeedbackKind) => {
      if (!feedback) return;
      const run = async () => {
        if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else if (kind === 'warning') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      };
      // Devices without a vibration motor (and most browsers) simply do nothing.
      run().catch(() => undefined);
    },
    [feedback],
  );
}

let romanianVoice: string | null | undefined; // undefined = not looked up yet, null = none installed

async function voiceOptions(): Promise<Speech.SpeechOptions> {
  if (romanianVoice === undefined) {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      romanianVoice = voices.find((v) => v.language?.toLowerCase().startsWith('ro'))?.identifier ?? null;
    } catch {
      romanianVoice = null;
    }
  }
  // A Romanian voice when the phone has one; otherwise the default voice, which still reads the text.
  return romanianVoice ? { language: 'ro-RO', voice: romanianVoice } : {};
}

export async function speak(text: string, onDone: () => void): Promise<void> {
  Speech.stop();
  const options = await voiceOptions();
  Speech.speak(text, { ...options, rate: 0.95, onDone, onStopped: onDone, onError: onDone });
}

export function stopSpeaking(): void {
  Speech.stop();
}
