import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  answerSuggestion,
  DEFAULT_PREFS,
  feedbackOn,
  loadPrefs,
  parsePrefs,
  PREFS_KEY,
  savePrefs,
  shouldSuggestScreenReaderMode,
  textFactor,
} from '../src/lib/a11yPrefs.ts';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    read: async (k: string) => data.get(k) ?? null,
    write: async (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

test('settings are saved on the device and read back', async () => {
  const storage = memoryStorage();
  assert.deepEqual(await loadPrefs(storage), DEFAULT_PREFS); // nothing saved yet
  const changed = { ...DEFAULT_PREFS, largeText: true, highContrast: true, feedback: false };
  await savePrefs(storage, changed);
  assert.ok(storage.data.has(PREFS_KEY));
  assert.deepEqual(await loadPrefs(storage), changed);
});

test('damaged or partial stored values fall back to defaults', () => {
  assert.deepEqual(parsePrefs('not json'), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('null'), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('{"largeText": true, "highContrast": "yes"}'), { ...DEFAULT_PREFS, largeText: true });
});

test('the screen-reader suggestion is shown once', async () => {
  const storage = memoryStorage();
  let prefs = await loadPrefs(storage);
  assert.equal(shouldSuggestScreenReaderMode(prefs, false), false); // no screen reader: never asked
  assert.equal(shouldSuggestScreenReaderMode(prefs, true), true);

  prefs = answerSuggestion(prefs, false); // "Nu, mulțumesc"
  await savePrefs(storage, prefs);
  prefs = await loadPrefs(storage); // next app start
  assert.equal(prefs.screenReaderMode, false);
  assert.equal(shouldSuggestScreenReaderMode(prefs, true), false);

  const accepted = answerSuggestion(DEFAULT_PREFS, true); // "Da"
  assert.equal(accepted.screenReaderMode, true);
  assert.equal(shouldSuggestScreenReaderMode(accepted, true), false);
});

test('mode switched on by hand is not questioned again', () => {
  assert.equal(shouldSuggestScreenReaderMode({ ...DEFAULT_PREFS, screenReaderMode: true }, true), false);
});

test('vibrations follow the screen-reader mode unless chosen explicitly', () => {
  assert.equal(feedbackOn(DEFAULT_PREFS), false);
  assert.equal(feedbackOn({ ...DEFAULT_PREFS, screenReaderMode: true }), true);
  assert.equal(feedbackOn({ ...DEFAULT_PREFS, screenReaderMode: true, feedback: false }), false);
  assert.equal(feedbackOn({ ...DEFAULT_PREFS, feedback: true }), true);
});

test('large text scales by 1.3', () => {
  assert.equal(textFactor(DEFAULT_PREFS), 1);
  assert.equal(textFactor({ ...DEFAULT_PREFS, largeText: true }), 1.3);
});
