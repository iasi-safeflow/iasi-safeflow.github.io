import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/lib/themeMode';
import type { MapMarker, MapProps } from './LeafletMap';
import {
  APPROX_RADIUS_M,
  COOP_HINT_HTML,
  COOP_IDLE_MS,
  COOP_PULSE_MS,
  COOP_SWIPE_PX,
  MAP_CSS,
  mapVars,
  pinSvg,
  SELECTED_Y,
  TILE_ATTRIBUTION,
  TILE_URL,
} from './mapTheme';

// Web counterpart of LeafletMap.tsx: same props, Leaflet bundled from npm and rendered directly in the page.
// Tiles follow the OSM tile usage policy (attribution shown, light demo use only).

const IASI = { lat: 47.1585, lon: 27.6014, zoom: 13 };

let cssAdded = false;
function addMapCss() {
  if (cssAdded) return;
  const el = document.createElement('style');
  el.textContent = MAP_CSS;
  document.head.appendChild(el);
  cssAdded = true;
}

// Watermark only where touch is the main input (phones, tablets); computers with a mouse never see it.
const touchFirst = () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

export function LeafletMap({
  markers = [],
  selectedId = null,
  onSelect,
  pick = null,
  pickable = false,
  onPick,
  center,
  style,
  cooperativeGestures = false,
}: MapProps) {
  const { colors, dark } = useTheme();
  const host = useRef<HTMLElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickMarker = useRef<L.Marker | null>(null);
  // Refs so the single click handler always sees the latest props.
  const cb = useRef({ pickable, onPick, onSelect });
  cb.current = { pickable, onPick, onSelect };
  const initial = useMemo(() => center ?? IASI, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    addMapCss();
    el.classList.add('sf-map');
    // The mouse wheel over the map zooms it; outside the map the page scrolls as usual.
    const m = L.map(el, { zoomControl: false }).setView([initial.lat, initial.lon], initial.zoom ?? 13);
    L.control.zoom({ position: 'topright' }).addTo(m);
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
      referrerPolicy: 'strict-origin-when-cross-origin',
    } as L.TileLayerOptions).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      const { pickable: can, onPick: pickCb, onSelect: selectCb } = cb.current;
      if (can && pickCb) pickCb(e.latlng.lat, e.latlng.lng);
      else selectCb?.(null);
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

  // Two-finger mode, same rules as the phone app: a touch with one finger is left to the page (the mouse still
  // drags with one button), two fingers move and zoom the map (Leaflet's pinch handler also pans) and the page
  // stays still. Capture listeners run before Leaflet's own handlers on the container.
  useEffect(() => {
    const m = map.current;
    const el = host.current;
    if (!m || !el || !cooperativeGestures) return;
    el.classList.add('sf-coop');
    let hint: HTMLDivElement | null = null;
    if (touchFirst()) {
      hint = document.createElement('div');
      hint.innerHTML = COOP_HINT_HTML;
      el.appendChild(hint);
    }
    let touching = false;
    let idle = true;
    let pulsing = false;
    let pulsed = false;
    let twoFingers = false;
    let start = { x: 0, y: 0 };
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let pulseTimer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      if (hint) hint.className = 'sf-hint' + (pulsing ? ' sf-pulse' : idle ? '' : ' sf-off');
    };
    // A one-finger swipe briefly shows the watermark at full strength, once per gesture.
    const pulse = () => {
      if (pulsed) return;
      pulsed = pulsing = true;
      draw();
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => {
        pulsing = false;
        if (!touching) {
          clearTimeout(idleTimer);
          idle = true;
        }
        draw();
      }, COOP_PULSE_MS);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') m.dragging.disable();
      else m.dragging.enable();
    };
    const onTouchStart = (e: TouchEvent) => {
      m.dragging.disable();
      if (!touching) {
        pulsed = twoFingers = false;
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      touching = true;
      idle = false;
      clearTimeout(idleTimer);
      if (e.touches.length >= 2) twoFingers = true;
      draw();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      const t = e.touches[0];
      if (!twoFingers && (Math.abs(t.clientX - start.x) > COOP_SWIPE_PX || Math.abs(t.clientY - start.y) > COOP_SWIPE_PX)) pulse();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return;
      touching = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idle = true;
        draw();
      }, COOP_IDLE_MS);
    };
    draw();
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    el.addEventListener('touchend', onTouchEnd, true);
    el.addEventListener('touchcancel', onTouchEnd, true);
    return () => {
      clearTimeout(idleTimer);
      clearTimeout(pulseTimer);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('touchstart', onTouchStart, true);
      el.removeEventListener('touchmove', onTouchMove, true);
      el.removeEventListener('touchend', onTouchEnd, true);
      el.removeEventListener('touchcancel', onTouchEnd, true);
      hint?.remove();
      el.classList.remove('sf-coop');
      m.dragging.enable();
    };
  }, [cooperativeGestures]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.classList.toggle('sf-dark', dark);
    Object.entries(mapVars(colors)).forEach(([k, v]) => el.style.setProperty(k, v));
  }, [colors, dark]);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    let selected: MapMarker | undefined;
    markers.forEach((mk) => {
      if (mk.id === selectedId) {
        selected = mk;
        return;
      }
      L.circleMarker([mk.lat, mk.lon], { radius: 8, color: colors.card, weight: 2.5, fillColor: mk.color, fillOpacity: 1 })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          cb.current.onSelect?.(mk.id);
        })
        .addTo(group);
    });
    if (selected) {
      L.circle([selected.lat, selected.lon], {
        radius: APPROX_RADIUS_M,
        color: selected.color,
        weight: 1.5,
        fillColor: selected.color,
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(group);
      L.marker([selected.lat, selected.lon], {
        icon: L.divIcon({ html: pinSvg(selected.color, colors.card), className: '', iconSize: [34, 44], iconAnchor: [17, 42] }),
        interactive: false,
      }).addTo(group);
    }
  }, [markers, selectedId, colors]);

  // A newly selected report is moved into the upper third, above the report card that covers the map's bottom.
  useEffect(() => {
    const m = map.current;
    const mk = markers.find((x) => x.id === selectedId);
    if (!m || !mk) return;
    const p = m.latLngToContainerPoint([mk.lat, mk.lon]);
    const target = L.point(m.getSize().x / 2, m.getSize().y * SELECTED_Y);
    m.panBy(p.subtract(target));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (pickMarker.current) {
      m.removeLayer(pickMarker.current);
      pickMarker.current = null;
    }
    // An SVG pin avoids Leaflet's default PNG icon, whose image paths break under bundlers.
    if (pick) {
      pickMarker.current = L.marker([pick.lat, pick.lon], {
        icon: L.divIcon({ html: pinSvg(colors.primary, colors.card), className: '', iconSize: [34, 44], iconAnchor: [17, 42] }),
        interactive: false,
      }).addTo(m);
    }
  }, [pick, colors]);

  useEffect(() => {
    if (map.current && center) map.current.setView([center.lat, center.lon], center.zoom ?? 16);
  }, [center?.lat, center?.lon, center?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // On web a View renders a <div>; its ref is that DOM node.
  return (
    <View
      ref={(node: unknown) => {
        host.current = node as HTMLElement | null;
      }}
      style={[styles.map, { backgroundColor: colors.map.land }, style]}
    />
  );
}

const styles = StyleSheet.create({ map: { overflow: 'hidden', zIndex: 0 } });
