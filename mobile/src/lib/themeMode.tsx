import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { palettes, ThemeColors } from '@/theme';
import { readToken, writeToken } from './tokenStore';

// Light/dark theme. 'auto' follows the phone or browser setting; the choice is saved on the device in the same
// small store as the session (keystore on the phone, localStorage on the web).

export type ThemeMode = 'auto' | 'light' | 'dark';

const MODE_KEY = 'safeflow.theme';

type ThemeState = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  dark: boolean;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  useEffect(() => {
    readToken(MODE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'auto') setModeState(saved);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void writeToken(MODE_KEY, m);
  }, []);

  const dark = mode === 'dark' || (mode === 'auto' && system === 'dark');
  const value = useMemo(() => ({ mode, setMode, dark, colors: dark ? palettes.dark : palettes.light }), [mode, setMode, dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
