import assert from 'node:assert/strict';
import { test } from 'node:test';

import { palettes, type ThemeColors } from '../src/theme.ts';

// WCAG relative luminance and contrast ratio. Semi-transparent badge backgrounds are blended over the card.
function rgb(c: string, over?: string): [number, number, number] {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(c);
  if (m) {
    const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const base = rgb(over ?? '#FFFFFF');
    return [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
  }
  const h = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg: string, bg: string, over?: string): number {
  const [a, b] = [luminance(rgb(fg, over)), luminance(rgb(bg, over))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

function textPairs(c: ThemeColors): [string, string, string][] {
  const pairs: [string, string, string][] = [
    ['text/bg', c.text, c.bg],
    ['text/card', c.text, c.card],
    ['muted/bg', c.muted, c.bg],
    ['muted/card', c.muted, c.card],
    ['onPrimary/primary', c.onPrimary, c.primary],
    ['primarySoftText/primarySoft', c.primarySoftText, c.primarySoft],
    ['primarySoftText/card', c.primarySoftText, c.card],
    ['alertText/alertBg', c.alertText, c.alertBg],
    ['onAlertButton/alertButton', c.onAlertButton, c.alertButton],
  ];
  for (const [k, v] of Object.entries(c.statusSoft)) pairs.push([`statusSoft.${k}`, v.text, v.bg]);
  return pairs;
}

for (const [name, min] of [['hcLight', 7], ['hcDark', 7], ['light', 4.5], ['dark', 4.5]] as const) {
  test(`${name}: every text pair reaches ${min}:1`, () => {
    const c = palettes[name];
    const low = textPairs(c)
      .map(([label, fg, bg]) => [label, ratio(fg, bg, c.card)] as const)
      .filter(([, r]) => r < min);
    assert.deepEqual(low.map(([l, r]) => `${l} ${r.toFixed(2)}`), []);
  });
}

test('high contrast draws thicker lines and borders that stand out', () => {
  for (const name of ['hcLight', 'hcDark'] as const) {
    const c = palettes[name];
    assert.equal(c.highContrast, true);
    assert.ok(c.lineWidth >= 2);
    assert.ok(ratio(c.border, c.card) >= 7, `${name} border`);
    assert.ok(ratio(c.focus, c.bg) >= 7, `${name} focus outline`);
  }
});
