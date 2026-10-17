import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// Leaflet + OpenStreetMap inside a WebView: no API key. Tiles follow the OSM tile usage policy
// (attribution shown, light demo use only; https://operations.osmfoundation.org/policies/tiles/).

export type MapMarker = {
  id: string;
  lat: number;
  lon: number;
  color: string;
  popupLines: string[]; // rendered as plain text, never HTML
};

type Props = {
  markers?: MapMarker[];
  pick?: { lat: number; lon: number } | null;
  pickable?: boolean;
  onPick?: (lat: number, lon: number) => void;
  center?: { lat: number; lon: number; zoom?: number };
  style?: StyleProp<ViewStyle>;
};

const IASI = { lat: 47.1585, lon: 27.6014, zoom: 13 };

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0} .leaflet-popup-content{font:14px sans-serif}</style>
</head><body><div id="map"></div><script>
function send(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
var map = L.map('map', { zoomControl: true });
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; contribuitorii <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  referrerPolicy: 'strict-origin-when-cross-origin'
}).addTo(map);
var layer = L.layerGroup().addTo(map);
var pickMarker = null, pickable = false;
window.sfSetView = function(lat, lon, zoom){ map.setView([lat, lon], zoom); };
window.sfSetMarkers = function(list){
  layer.clearLayers();
  list.forEach(function(m){
    var el = document.createElement('div');
    m.popupLines.forEach(function(line, i){ var p = document.createElement(i === 0 ? 'b' : 'div'); p.textContent = line; el.appendChild(p); });
    L.circleMarker([m.lat, m.lon], { radius: 9, color: '#fff', weight: 2, fillColor: m.color, fillOpacity: 0.9 })
      .bindPopup(el).on('click', function(){ send({ type: 'select', id: m.id }); }).addTo(layer);
  });
};
window.sfSetPick = function(p, isPickable){
  pickable = isPickable;
  if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
  if (p) { pickMarker = L.marker([p.lat, p.lon]).addTo(map); }
};
map.on('click', function(e){ if (pickable) send({ type: 'pick', lat: e.latlng.lat, lon: e.latlng.lng }); });
send({ type: 'ready' });
</script></body></html>`;

export function LeafletMap({ markers = [], pick = null, pickable = false, onPick, center, style }: Props) {
  // Explicit generic: the package's default (P = undefined) collapses props to 'never' under TS 6.
  const ref = useRef<WebView<{}>>(null);
  const ready = useRef(false);
  const initial = useMemo(() => center ?? IASI, []); // eslint-disable-line react-hooks/exhaustive-deps

  const push = useCallback(() => {
    if (!ready.current) return;
    ref.current?.injectJavaScript(
      `window.sfSetMarkers(${JSON.stringify(markers)}); window.sfSetPick(${JSON.stringify(pick)}, ${pickable}); true;`,
    );
  }, [markers, pick, pickable]);

  useEffect(push, [push]);

  useEffect(() => {
    if (ready.current && center) {
      ref.current?.injectJavaScript(`window.sfSetView(${center.lat}, ${center.lon}, ${center.zoom ?? 16}); true;`);
    }
  }, [center?.lat, center?.lon, center?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; lat?: number; lon?: number };
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
    }
  };

  return (
    <WebView<{}>
      ref={ref}
      originWhitelist={['*']}
      source={{ html: HTML, baseUrl: 'https://iasi-safeflow.local/' }}
      onMessage={onMessage}
      javaScriptEnabled
      style={style}
      setSupportMultipleWindows={false}
    />
  );
}
