// Distance and direction for the accessible report list ("la 120 de metri spre nord-est").
// No imports, so `node --test` can run its tests directly (mobile/tests/geo.test.ts).

export type Point = { lat: number; lon: number };

const EARTH_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

// Compass bearing from a to b, 0–360°, 0 = north, 90 = east.
export function bearingDeg(a: Point, b: Point): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const DIRECTIONS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-vest', 'vest', 'nord-vest'];

// One of eight compass directions, each covering 45° centred on it.
export function direction(bearing: number): string {
  return DIRECTIONS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

// Romanian counting: 1 metru, 2–19 metri, 20+ "de metri" (also 101–119 → "metri", 120 → "de metri").
export function countWord(n: number, one: string, few: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return n !== 0 && (rest === 0 || rest >= 20) ? `${n} de ${few}` : `${n} ${few}`;
}

// "la 120 de metri" / "la 1,4 kilometri". Under 1 km, rounded to 10 m (5 m when very close).
export function formatDistance(m: number): string {
  if (m < 1000) {
    const step = m < 50 ? 5 : 10;
    const rounded = Math.max(step, Math.round(m / step) * step);
    return `la ${countWord(rounded, 'metru', 'metri')}`;
  }
  const km = Math.round(m / 100) / 10;
  if (Number.isInteger(km)) return `la ${countWord(km, 'kilometru', 'kilometri')}`;
  return `la ${String(km).replace('.', ',')} kilometri`;
}

export function describeFrom(origin: Point, target: Point): string {
  return `${formatDistance(distanceM(origin, target))} spre ${direction(bearingDeg(origin, target))}`;
}

// Nearest first. Without an origin the order is kept (the caller passes newest first).
export function sortByDistance<T extends Point>(items: T[], origin: Point | null): T[] {
  if (!origin) return [...items];
  return items
    .map((item, i) => ({ item, i, d: distanceM(origin, item) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.item);
}
