import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import type { Point } from './geo';

export type PositionState =
  | { status: 'idle' | 'locating' | 'denied' | 'failed'; point: null; accuracy: null }
  | { status: 'ok'; point: Point; accuracy: number | null };

// The user's current position, asked for only when a feature needs it (list distances, GPS location).
export function usePosition() {
  const [state, setState] = useState<PositionState>({ status: 'idle', point: null, accuracy: null });

  const request = useCallback(async (): Promise<PositionState> => {
    setState({ status: 'locating', point: null, accuracy: null });
    let next: PositionState;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        next = { status: 'denied', point: null, accuracy: null };
      } else {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        next = {
          status: 'ok',
          point: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          accuracy: pos.coords.accuracy ?? null,
        };
      }
    } catch {
      next = { status: 'failed', point: null, accuracy: null };
    }
    setState(next);
    return next;
  }, []);

  return { ...state, request };
}
