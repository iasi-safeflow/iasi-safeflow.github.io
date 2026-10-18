import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { useTheme } from '@/lib/themeMode';
import { APPROX_RADIUS_M, MAP_CSS, mapVars, pinSvg, SELECTED_Y, TILE_ATTRIBUTION, TILE_URL } from './mapTheme';

// Leaflet + OpenStreetMap inside a WebView: no API key. Tiles follow the OSM tile usage policy
// (attribution shown, light demo use only; https://operations.osmfoundation.org/policies/tiles/).

export type MapMarker = {
  id: string;
  lat: number;
  lon: number;
  color: string; // status colour from the theme
};

export type MapProps = {
  markers?: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  pick?: { lat: number; lon: number } | null;
  pickable?: boolean;
  onPick?: (lat: number, lon: number) => void;
  center?: { lat: number; lon: number; zoom?: number };
  style?: StyleProp<ViewStyle>;
};

const IASI = { lat: 47.1585, lon: 27.6014, zoom: 13 };

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<style>html,body,#map{height:100%;margin:0;background:var(--sf-land)} ${MAP_CSS}</style>
</head><body><div id="map" class="sf-map"></div><script>
function send(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
var map = L.map('map', { zoomControl: false });
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer(${JSON.stringify(TILE_URL)}, {
  maxZoom: 19,
  attribution: ${JSON.stringify(TILE_ATTRIBUTION)},
  referrerPolicy: 'strict-origin-when-cross-origin'
}).addTo(map);
var layer = L.layerGroup().addTo(map);
var pickMarker = null, pickable = false, ring = null; // ring is set by sfSetTheme before anything is drawn
// The pin SVG is passed as text with placeholders (release builds can't turn a JS function back into source).
var PIN = ${JSON.stringify(pinSvg('__FILL__', '__RING__'))};
function pinIcon(fill){
  var html = PIN.split('__FILL__').join(fill).split('__RING__').join(ring);
  return L.divIcon({ html: html, className: '', iconSize: [34, 44], iconAnchor: [17, 42] });
}
window.sfSetTheme = function(dark, vars){
  var root = document.documentElement, el = document.getElementById('map');
  Object.keys(vars).forEach(function(k){ root.style.setProperty(k, vars[k]); });
  el.classList.toggle('sf-dark', dark);
  ring = vars['--sf-card'];
};
window.sfSetView = function(lat, lon, zoom){ map.setView([lat, lon], zoom); };
var lastSelected = null;
window.sfSetMarkers = function(list, selectedId){
  layer.clearLayers();
  var selected = null;
  list.forEach(function(m){
    if (m.id === selectedId) { selected = m; return; }
    L.circleMarker([m.lat, m.lon], { radius: 8, color: ring, weight: 2.5, fillColor: m.color, fillOpacity: 1 })
      .on('click', function(e){ L.DomEvent.stopPropagation(e); send({ type: 'select', id: m.id }); }).addTo(layer);
  });
  if (selected) {
    L.circle([selected.lat, selected.lon], { radius: ${APPROX_RADIUS_M}, color: selected.color, weight: 1.5, fillColor: selected.color, fillOpacity: 0.15, interactive: false }).addTo(layer);
    L.marker([selected.lat, selected.lon], { icon: pinIcon(selected.color), interactive: false }).addTo(layer);
    // A newly selected report is moved into the upper part, above the report card that covers the map's bottom.
    if (selectedId !== lastSelected) {
      var p = map.latLngToContainerPoint([selected.lat, selected.lon]);
      map.panBy(p.subtract(L.point(map.getSize().x / 2, map.getSize().y * ${SELECTED_Y})));
    }
  }
  lastSelected = selectedId;
};
window.sfSetPick = function(p, isPickable, color){
  pickable = isPickable;
  if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
  if (p) { pickMarker = L.marker([p.lat, p.lon], { icon: pinIcon(color), interactive: false }).addTo(map); }
};
map.on('click', function(e){
  if (pickable) send({ type: 'pick', lat: e.latlng.lat, lon: e.latlng.lng });
  else send({ type: 'select', id: null });
});
send({ type: 'ready' });
</script></body></html>`;

export function LeafletMap({ markers = [], selectedId = null, onSelect, pick = null, pickable = false, onPick, center, style }: MapProps) {
  const { colors, dark } = useTheme();
  // Explicit generic: the package's default (P = undefined) collapses props to 'never' under TS 6.
  const ref = useRef<WebView<{}>>(null);
  const ready = useRef(false);
  const initial = useMemo(() => center ?? IASI, []); // eslint-disable-line react-hooks/exhaustive-deps

  const push = useCallback(() => {
    if (!ready.current) return;
    ref.current?.injectJavaScript(
      `window.sfSetTheme(${dark}, ${JSON.stringify(mapVars(colors))});` +
        `window.sfSetMarkers(${JSON.stringify(markers)}, ${JSON.stringify(selectedId)});` +
        `window.sfSetPick(${JSON.stringify(pick)}, ${pickable}, ${JSON.stringify(colors.primary)}); true;`,
    );
  }, [markers, selectedId, pick, pickable, colors, dark]);

  useEffect(push, [push]);

  useEffect(() => {
    if (ready.current && center) {
      ref.current?.injectJavaScript(`window.sfSetView(${center.lat}, ${center.lon}, ${center.zoom ?? 16}); true;`);
    }
  }, [center?.lat, center?.lon, center?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; lat?: number; lon?: number; id?: string | null };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      ready.current = true;
      ref.current?.injectJavaScript(`window.sfSetView(${initial.lat}, ${initial.lon}, ${initial.zoom ?? 13}); true;`);
      push();
    } else if (msg.type === 'pick' && onPick && typeof msg.lat === 'number' && typeof msg.lon === 'number') {
      onPick(msg.lat, msg.lon);
    } else if (msg.type === 'select' && onSelect) {
      onSelect(typeof msg.id === 'string' ? msg.id : null);
    }
  };

  return (
    <WebView<{}>
      ref={ref}
      originWhitelist={['*']}
      source={{ html: HTML, baseUrl: 'https://iasi-safeflow.local/' }}
      onMessage={onMessage}
      javaScriptEnabled
      style={[{ backgroundColor: colors.map.land }, style]}
      setSupportMultipleWindows={false}
    />
  );
}
