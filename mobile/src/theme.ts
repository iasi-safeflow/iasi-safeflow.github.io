// The one place for colours and fonts ("L – Neighbourly" design). Screens use these tokens, never raw values.
// Text pairs are checked for at least 4.5:1 contrast in both modes; status colours are used for map dots and
// accents, and status labels use the soft badge pairs below.

export type StatusKey = 'submitted' | 'under_review' | 'referred' | 'resolved' | 'rejected' | 'expired';

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
  alertBg: '#FDE8E7',
  alertText: '#8A1C14',
  alertButton: '#C62828',
  onAlertButton: '#FFFFFF',
  status: {
    submitted: '#2F6FE0',
    under_review: '#E46A12',
    referred: '#8B5CF6',
    resolved: '#1F9254',
    rejected: '#6B6780',
    expired: '#6B6780',
  },
  statusSoft: {
    submitted: { bg: '#E3ECFC', text: '#1C4FAF' },
    under_review: { bg: '#FFEBDA', text: '#9A4508' },
    referred: { bg: '#EFE8FE', text: '#5B33B6' },
    resolved: { bg: '#DDF3E6', text: '#14693A' },
    rejected: { bg: '#ECEBF1', text: '#4F4B63' },
    expired: { bg: '#ECEBF1', text: '#4F4B63' },
  },
  map: { land: '#ECEAF4', road: '#FFFFFF', roadMajor: '#DAD6E8', water: '#CBDDF5', park: '#D8EBD9' },
  shadow: 'rgba(34, 28, 53, 0.12)',
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
  alertBg: '#41191A',
  alertText: '#FFBDB6',
  alertButton: '#D32F2F',
  onAlertButton: '#FFFFFF',
  status: {
    submitted: '#7EA8FF',
    under_review: '#FFA45C',
    referred: '#C4A8FF',
    resolved: '#6EDCA0',
    rejected: '#9C95B0',
    expired: '#9C95B0',
  },
  statusSoft: {
    submitted: { bg: 'rgba(126, 168, 255, 0.18)', text: '#A9C4FF' },
    under_review: { bg: 'rgba(255, 164, 92, 0.18)', text: '#FFB57E' },
    referred: { bg: 'rgba(196, 168, 255, 0.18)', text: '#DCCBFF' },
    resolved: { bg: 'rgba(110, 220, 160, 0.18)', text: '#98E9BE' },
    rejected: { bg: 'rgba(156, 149, 176, 0.18)', text: '#C9C3D9' },
    expired: { bg: 'rgba(156, 149, 176, 0.18)', text: '#C9C3D9' },
  },
  map: { land: '#1C1828', road: '#2A2539', roadMajor: '#3A3350', water: '#182B4A', park: '#1B2A22' },
  shadow: 'rgba(0, 0, 0, 0.45)',
};

export const palettes = { light, dark };

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
