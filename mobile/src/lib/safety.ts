// Client-side mirror of backend/app/safety.py. The server check is authoritative;
// this one lets the app stop the form before anything leaves the phone.

import { EMERGENCY_CATEGORY } from './i18n';

export const EMERGENCY_MESSAGE =
  'Sunați la 112. SafeFlow nu este un serviciu de urgență și nu a anunțat pe nimeni.';

const KEYWORDS = [
  'ranit', 'raniti', 'ranita', 'ranire', 'accidentat',
  'sange', 'sanger',
  'inconstient', 'lesinat', 'nu respira', 'nu (mai )?misca',
  'victim', 'decedat', '(?<!unghi )mort\\b', 'morti\\b',
  'ambulant', 'smurd', 'urgenta',
  'foc\\b', 'incendiu', 'in flacari', 'arde\\b', 'ard\\b', 'fum dens',
  'pericol imediat', 'pericol iminent', 'se intampla acum', 'acum are loc',
  'blocat in masina', 'prins in masina', 'incarcerat',
  'ajutor\\b',
  'injur', 'bleeding', 'unconscious', 'on fire', 'happening now', 'immediate danger',
];
const PATTERN = new RegExp('\\b(?:' + KEYWORDS.join('|') + ')');

export function normalize(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

export function needsEmergencyStop(input: {
  category?: string | null;
  description?: string;
  immediateDanger?: boolean | null;
}): boolean {
  if (input.category === EMERGENCY_CATEGORY) return true;
  if (input.immediateDanger === true) return true;
  return !!input.description && PATTERN.test(normalize(input.description));
}
