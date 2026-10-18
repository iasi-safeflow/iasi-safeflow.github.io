// Accessibility settings saved on the device (like the theme). No imports, so `node --test` covers the rules
// directly (mobile/tests/a11yPrefs.test.ts); the React provider is in a11ySettings.tsx.

export type A11yPrefs = {
  screenReaderMode: boolean; // simplified mode for blind users: list instead of map, step-by-step form
  srPromptAnswered: boolean; // the "Folosiți un cititor de ecran…" question was answered (never asked again)
  largeText: boolean; // ×1.3 on top of the system text size
  highContrast: boolean;
  feedback: boolean | null; // vibrations; null = follow the screen-reader mode
};

export const DEFAULT_PREFS: A11yPrefs = {
  screenReaderMode: false,
  srPromptAnswered: false,
  largeText: false,
  highContrast: false,
  feedback: null,
};

export const PREFS_KEY = 'safeflow.a11y';
export const LARGE_TEXT_FACTOR = 1.3;

// Unknown or damaged stored values fall back to the defaults, field by field.
export function parsePrefs(raw: string | null): A11yPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const bool = (k: keyof A11yPrefs) => (typeof d[k] === 'boolean' ? (d[k] as boolean) : (DEFAULT_PREFS[k] as boolean));
  return {
    screenReaderMode: bool('screenReaderMode'),
    srPromptAnswered: bool('srPromptAnswered'),
    largeText: bool('largeText'),
    highContrast: bool('highContrast'),
    feedback: typeof d.feedback === 'boolean' ? d.feedback : null,
  };
}

export function serializePrefs(p: A11yPrefs): string {
  return JSON.stringify(p);
}

// Ask once, only while a screen reader is running and the mode is still off.
export function shouldSuggestScreenReaderMode(p: A11yPrefs, screenReaderRunning: boolean): boolean {
  return screenReaderRunning && !p.screenReaderMode && !p.srPromptAnswered;
}

export function answerSuggestion(p: A11yPrefs, accepted: boolean): A11yPrefs {
  return { ...p, srPromptAnswered: true, screenReaderMode: accepted ? true : p.screenReaderMode };
}

// Vibrations are on by default in the screen-reader mode; an explicit choice always wins.
export function feedbackOn(p: A11yPrefs): boolean {
  return p.feedback ?? p.screenReaderMode;
}

export function textFactor(p: A11yPrefs): number {
  return p.largeText ? LARGE_TEXT_FACTOR : 1;
}

export type Storage = { read: (key: string) => Promise<string | null>; write: (key: string, value: string) => Promise<void> };

export async function loadPrefs(storage: Storage): Promise<A11yPrefs> {
  return parsePrefs(await storage.read(PREFS_KEY));
}

export async function savePrefs(storage: Storage, p: A11yPrefs): Promise<void> {
  await storage.write(PREFS_KEY, serializePrefs(p));
}
