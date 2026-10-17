import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MapMarker } from './LeafletMap';

// Web counterpart of LeafletMap.tsx: same props, Leaflet bundled from npm and rendered directly in the page.
// Tiles follow the OSM tile usage policy (attribution shown, light demo use only).

type Props = {
  markers?: MapMarker[];
  pick?: { lat: number; lon: number } | null;
  pickable?: boolean;
  onPick?: (lat: number, lon: number) => void;
  center?: { lat: number; lon: number; zoom?: number };
  style?: any;
};

const IASI = { lat: 47.1585, lon: 27.6014, zoom: 13 };

export function LeafletMap({ markers = [], pick = null, pickable = false, onPick, center, style }: Props) {
  const host = useRef<HTMLElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickMarker = useRef<L.CircleMarker | null>(null);
  // Refs so the single click handler always sees the latest props.
  const pickRef = useRef({ pickable, onPick });
  pickRef.current = { pickable, onPick };
  const initial = useMemo(() => center ?? IASI, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // No wheel zoom: on web the map sits inside scrolling forms and would swallow page scrolling.
    const m = L.map(el, { zoomControl: true, scrollWheelZoom: false }).setView([initial.lat, initial.lon], initial.zoom ?? 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; contribuitorii <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      referrerPolicy: 'strict-origin-when-cross-origin',
    } as L.TileLayerOptions).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      const { pickable: can, onPick: cb } = pickRef.current;
      if (can && cb) cb(e.latlng.lat, e.latlng.lng);
    });
    map.current = m;
    // The container may get its final size after layout; recompute once it has settled.
    const t = setTimeout(() => m.invalidateSize(), 0);
    return () => {
      clearTimeout(t);
      m.remove();
      map.current = null;
    };
  }, [initial]);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    markers.forEach((mk) => {
      // Popup content is built with textContent: plain text, never HTML.
      const el = document.createElement('div');
      mk.popupLines.forEach((line, i) => {
        const p = document.createElement(i === 0 ? 'b' : 'div');
        p.textContent = line;
        el.appendChild(p);
      });
      L.circleMarker([mk.lat, mk.lon], { radius: 9, color: '#fff', weight: 2, fillColor: mk.color, fillOpacity: 0.9 })
        .bindPopup(el)
        .addTo(group);
    });
  }, [markers]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (pickMarker.current) {
      m.removeLayer(pickMarker.current);
      pickMarker.current = null;
    }
    // A circle marker avoids Leaflet's default PNG icon, whose image paths break under bundlers.
    if (pick) {
      pickMarker.current = L.circleMarker([pick.lat, pick.lon], {
        radius: 11,
        color: '#1d4ed8',
        weight: 3,
        fillColor: '#3b82f6',
        fillOpacity: 0.6,
      }).addTo(m);
    }
  }, [pick]);

  useEffect(() => {
    if (map.current && center) map.current.setView([center.lat, center.lon], center.zoom ?? 16);
  }, [center?.lat, center?.lon, center?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // On web a View renders a <div>; its ref is that DOM node.
  return <View ref={(node: unknown) => { host.current = node as HTMLElement | null; }} style={[styles.map, style]} />;
}

const styles = StyleSheet.create({ map: { overflow: 'hidden', zIndex: 0 } });
