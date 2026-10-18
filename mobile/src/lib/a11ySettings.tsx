import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useScreenReader } from './a11y';
import { A11yPrefs, DEFAULT_PREFS, feedbackOn, loadPrefs, savePrefs, textFactor } from './a11yPrefs';
import { readToken, writeToken } from './tokenStore';

// Accessibility settings ("Accesibilitate" in Cont), saved on the device in the same small store as the theme.

type A11yState = {
  prefs: A11yPrefs;
  ready: boolean;
  update: (change: Partial<A11yPrefs>) => void;
  screenReaderRunning: boolean; // TalkBack / VoiceOver is on (always false on the web: browsers don't say)
  srMode: boolean;
  feedback: boolean;
  textFactor: number;
};

const storage = { read: readToken, write: writeToken };
const A11yContext = createContext<A11yState | null>(null);

export function A11yProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const screenReaderRunning = useScreenReader();
  const latest = useRef(prefs);

  useEffect(() => {
    loadPrefs(storage).then((p) => {
      latest.current = p;
      setPrefs(p);
      setReady(true);
    });
  }, []);

  const update = useCallback((change: Partial<A11yPrefs>) => {
    const next = { ...latest.current, ...change };
    latest.current = next;
    setPrefs(next);
    void savePrefs(storage, next);
  }, []);

  const value = useMemo(
    () => ({
      prefs,
      ready,
      update,
      screenReaderRunning,
      srMode: prefs.screenReaderMode,
      feedback: feedbackOn(prefs),
      textFactor: textFactor(prefs),
    }),
    [prefs, ready, update, screenReaderRunning],
  );
  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y(): A11yState {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useA11y must be used inside A11yProvider');
  return ctx;
}
