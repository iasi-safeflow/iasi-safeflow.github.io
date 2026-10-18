import type { ThemeColors } from '@/theme';

// Shared by LeafletMap.tsx (inside its WebView) and LeafletMap.web.tsx. Colours come in as CSS variables set
// from the theme tokens, so this file holds no colour values of its own.
// Dark mode dims the standard OSM tiles with a CSS filter (no extra tile provider or API key).
export const MAP_CSS = `
.sf-map { background: var(--sf-land); }
.sf-map.sf-dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.85) saturate(0.6); }
.sf-map .leaflet-bar { border: 1px solid var(--sf-border); border-radius: 14px; overflow: hidden; box-shadow: none; }
.sf-map .leaflet-bar a { background: var(--sf-card); color: var(--sf-text); border-bottom-color: var(--sf-border); width: 40px; height: 40px; line-height: 40px; }
.sf-map .leaflet-control-attribution { background: var(--sf-card); color: var(--sf-muted); border-radius: 10px 0 0 0; font: 11px/1.4 Nunito_600SemiBold, sans-serif; }
.sf-map .leaflet-control-attribution a { color: var(--sf-primary); }
.sf-map.sf-coop.leaflet-container { touch-action: pan-y; }
.sf-hint { position: absolute; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 800; display: flex; align-items: center; gap: 6px; max-width: calc(100% - 24px); box-sizing: border-box; padding: 6px 12px; border: 1px solid var(--sf-border); border-radius: 999px; background: var(--sf-card); color: var(--sf-text); font: 13px/1.3 Nunito_700Bold, sans-serif; white-space: nowrap; pointer-events: none; opacity: 0.7; transition: opacity 0.3s ease; }
.sf-hint svg { flex: none; }
.sf-hint span { overflow: hidden; text-overflow: ellipsis; }
.sf-hint.sf-off { opacity: 0; }
.sf-hint.sf-pulse { opacity: 1; }
.sf-map.sf-reduce-motion .sf-hint { transition: none; }
@media (prefers-reduced-motion: reduce) { .sf-hint { transition: none; } }
`;

export const mapVars = (c: ThemeColors) => ({
  '--sf-land': c.map.land,
  '--sf-card': c.card,
  '--sf-border': c.border,
  '--sf-text': c.text,
  '--sf-muted': c.muted,
  '--sf-primary': c.primary,
});

// Teardrop pin for the selected report and the picked location (SVG, so no image files are needed).
export const pinSvg = (fill: string, ring: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">` +
  `<path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8 1.5 28.3 17 42.5 17 42.5s15.5-14.2 15.5-25.7C32.5 8.3 25.6 1.5 17 1.5z" fill="${fill}" stroke="${ring}" stroke-width="2.5"/>` +
  `<circle cx="17" cy="17" r="6" fill="${ring}"/></svg>`;

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; contribuitorii <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Public locations are rounded to about 100 m; the circle shows that zone around the selected report.
export const APPROX_RADIUS_M = 100;

// Where a newly selected report is moved to, as a fraction of the map height (clear of the report card).
export const SELECTED_Y = 0.3;

// Two-finger mode (cooperativeGestures) for maps inside scrolling screens: one finger scrolls the page, two fingers
// move and zoom the map. The watermark shows this while the map is idle; at 70% opacity its text keeps at least
// 5.5:1 contrast against its pill over any tile colour, in both themes. It never takes touches (pointer-events: none).
export const COOP_HINT_HTML =
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v7"/>` +
  `<path d="M14 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L4 15.5a1.5 1.5 0 0 1 2.5-1.7L8 15.5V12"/></svg>` +
  `<span>Mutați harta cu două degete</span>`;
// Watermark timing: back after the last finger lifts, and how long a one-finger swipe keeps it fully visible.
export const COOP_IDLE_MS = 2000;
export const COOP_PULSE_MS = 1500;
// A single finger that moves this far is a scroll attempt, so the watermark pulses.
export const COOP_SWIPE_PX = 8;
