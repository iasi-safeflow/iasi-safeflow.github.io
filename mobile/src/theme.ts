// The one place for colours and fonts ("L – Neighbourly" design). Screens use these tokens, never raw values.
// Text pairs are checked for at least 4.5:1 contrast in both modes; status colours are used for map dots and
// accents, and status labels use the soft badge pairs below. The "Contrast ridicat" palettes (hcLight, hcDark) keep
// every text pair at 7:1 or more and draw thicker lines; mobile/tests/contrast.test.ts checks all of them.

export type StatusKey = 'submitted' | 'under_review' | 'validated' | 'referred' | 'resolved' | 'rejected' | 'expired';

export type ThemeColors = {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  primarySoftText: string;
  focus: string; // keyboard focus outline (web)
  alertBg: string; // 112 bar and stop screen
  alertText: string;
  alertButton: string;
  onAlertButton: string;
  status: Record<StatusKey, string>;
  statusSoft: Record<StatusKey, { bg: string; text: string }>;
  // Raster OSM tiles keep their own colours; `land` fills the map while tiles load. The rest document the
  // design's map palette for a future vector map.
  map: { land: string; road: string; roadMajor: string; water: string; park: string };
  shadow: string;
  lineWidth: number; // border thickness of cards, inputs and chips
  highContrast: boolean;
};

const light: ThemeColors = {
  bg: '#F5F3FB',
  card: '#FFFFFF',
  border: '#E4E0F0',
  text: '#221C35',
  muted: '#5D5672',
  primary: '#6941C6',
  onPrimary: '#FFFFFF',
  primarySoft: '#ECE5FB',
  primarySoftText: '#53389E',
  focus: '#6941C6',
  alertBg: '#FDE8E7',
  alertText: '#8A1C14',
  alertButton: '#C62828',
  onAlertButton: '#FFFFFF',
  status: {
    submitted: '#2F6FE0',
    under_review: '#E46A12',
    validated: '#0E8A86',
    referred: '#8B5CF6',
    resolved: '#1F9254',
    rejected: '#6B6780',
    expired: '#6B6780',
  },
  statusSoft: {
    submitted: { bg: '#E3ECFC', text: '#1C4FAF' },
    under_review: { bg: '#FFEBDA', text: '#9A4508' },
    validated: { bg: '#DAF2F0', text: '#0A5C59' },
    referred: { bg: '#EFE8FE', text: '#5B33B6' },
    resolved: { bg: '#DDF3E6', text: '#14693A' },
    rejected: { bg: '#ECEBF1', text: '#4F4B63' },
    expired: { bg: '#ECEBF1', text: '#4F4B63' },
  },
  map: { land: '#ECEAF4', road: '#FFFFFF', roadMajor: '#DAD6E8', water: '#CBDDF5', park: '#D8EBD9' },
  shadow: 'rgba(34, 28, 53, 0.12)',
  lineWidth: 1,
  highContrast: false,
};

const dark: ThemeColors = {
  bg: '#16131F',
  card: '#221D2E',
  border: '#332C44',
  text: '#F1EEF8',
  muted: '#B7B0C9',
  primary: '#B69CFF',
  onPrimary: '#1F0F45',
  primarySoft: '#33285A',
  primarySoftText: '#D6C8FF',
  focus: '#D6C8FF',
  alertBg: '#41191A',
  alertText: '#FFBDB6',
  alertButton: '#D32F2F',
  onAlertButton: '#FFFFFF',
  status: {
    submitted: '#7EA8FF',
    under_review: '#FFA45C',
    validated: '#5CD6CF',
    referred: '#C4A8FF',
    resolved: '#6EDCA0',
    rejected: '#9C95B0',
    expired: '#9C95B0',
  },
  statusSoft: {
    submitted: { bg: 'rgba(126, 168, 255, 0.18)', text: '#A9C4FF' },
    under_review: { bg: 'rgba(255, 164, 92, 0.18)', text: '#FFB57E' },
    validated: { bg: 'rgba(92, 214, 207, 0.18)', text: '#8FE6E0' },
    referred: { bg: 'rgba(196, 168, 255, 0.18)', text: '#DCCBFF' },
    resolved: { bg: 'rgba(110, 220, 160, 0.18)', text: '#98E9BE' },
    rejected: { bg: 'rgba(156, 149, 176, 0.18)', text: '#C9C3D9' },
    expired: { bg: 'rgba(156, 149, 176, 0.18)', text: '#C9C3D9' },
  },
  map: { land: '#1C1828', road: '#2A2539', roadMajor: '#3A3350', water: '#182B4A', park: '#1B2A22' },
  shadow: 'rgba(0, 0, 0, 0.45)',
  lineWidth: 1,
  highContrast: false,
};

// High contrast: black on white / white on black, dark saturated status colours, no light greys, 2 px lines.
const hcLight: ThemeColors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#000000',
  text: '#000000',
  muted: '#2B2B2B',
  primary: '#3A1A8C',
  onPrimary: '#FFFFFF',
  primarySoft: '#ECE5FF',
  primarySoftText: '#26096B',
  focus: '#000000',
  alertBg: '#FFE3E0',
  alertText: '#5C0000',
  alertButton: '#9E0000',
  onAlertButton: '#FFFFFF',
  status: {
    submitted: '#0B3FA8',
    under_review: '#8A3B00',
    validated: '#00544F',
    referred: '#4B1FA6',
    resolved: '#0B5A2A',
    rejected: '#333333',
    expired: '#333333',
  },
  statusSoft: {
    submitted: { bg: '#E6EEFF', text: '#0A2F80' },
    under_review: { bg: '#FFEBD9', text: '#6B2E00' },
    validated: { bg: '#DDF5F2', text: '#003F3B' },
    referred: { bg: '#EFE7FF', text: '#3A1580' },
    resolved: { bg: '#DFF5E7', text: '#0A4A22' },
    rejected: { bg: '#EDEDED', text: '#1F1F1F' },
    expired: { bg: '#EDEDED', text: '#1F1F1F' },
  },
  map: { land: '#F2F2F2', road: '#FFFFFF', roadMajor: '#BDBDBD', water: '#B3CCF0', park: '#C8E3CA' },
  shadow: 'rgba(0, 0, 0, 0.25)',
  lineWidth: 2,
  highContrast: true,
};

const hcDark: ThemeColors = {
  bg: '#000000',
  card: '#0D0D0D',
  border: '#FFFFFF',
  text: '#FFFFFF',
  muted: '#E6E6E6',
  primary: '#D7C8FF',
  onPrimary: '#000000',
  primarySoft: '#24124D',
  primarySoftText: '#FFFFFF',
  focus: '#FFFFFF',
  alertBg: '#3D0000',
  alertText: '#FFDAD5',
  alertButton: '#FF8A80',
  onAlertButton: '#000000',
  status: {
    submitted: '#9EC0FF',
    under_review: '#FFB27A',
    validated: '#7BEDE5',
    referred: '#D2BCFF',
    resolved: '#8BF0B5',
    rejected: '#D9D9D9',
    expired: '#D9D9D9',
  },
  statusSoft: {
    submitted: { bg: '#0F1F3D', text: '#C9DCFF' },
    under_review: { bg: '#3A1E06', text: '#FFD3B0' },
    validated: { bg: '#06302D', text: '#B5F5F0' },
    referred: { bg: '#261A40', text: '#E4D8FF' },
    resolved: { bg: '#082D18', text: '#BDF7D4' },
    rejected: { bg: '#262626', text: '#F2F2F2' },
    expired: { bg: '#262626', text: '#F2F2F2' },
  },
  map: { land: '#0A0A0A', road: '#262626', roadMajor: '#4D4D4D', water: '#102A52', park: '#10301A' },
  shadow: 'rgba(0, 0, 0, 0.6)',
  lineWidth: 2,
  highContrast: true,
};

export const palettes = { light, dark, hcLight, hcDark };

// Nunito, loaded in the root layout. Custom fonts need one family per weight (fontWeight alone doesn't switch it).
export const fonts = {
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const radius = { card: 24, button: 16, input: 16, chip: 999 };

// Minimum touch target.
export const TOUCH = 44;
