import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bearingDeg, countWord, describeFrom, direction, distanceM, formatDistance, sortByDistance } from '../src/lib/geo.ts';

const CENTRE = { lat: 47.1585, lon: 27.6014 };
const north = (m: number) => ({ lat: CENTRE.lat + m / 111_195, lon: CENTRE.lon });
const east = (m: number) => ({ lat: CENTRE.lat, lon: CENTRE.lon + m / (111_195 * Math.cos((CENTRE.lat * Math.PI) / 180)) });

test('distance matches known offsets', () => {
  assert.ok(Math.abs(distanceM(CENTRE, north(120)) - 120) < 0.5);
  assert.ok(Math.abs(distanceM(CENTRE, east(300)) - 300) < 0.5);
});

test('bearing and the eight Romanian directions', () => {
  assert.ok(Math.abs(bearingDeg(CENTRE, north(100)) - 0) < 0.5);
  assert.ok(Math.abs(bearingDeg(CENTRE, east(100)) - 90) < 0.5);
  assert.deepEqual(
    [0, 45, 90, 135, 180, 225, 270, 315].map(direction),
    ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-vest', 'vest', 'nord-vest'],
  );
  assert.equal(direction(22), 'nord');
  assert.equal(direction(23), 'nord-est');
  assert.equal(direction(359), 'nord');
  assert.equal(direction(-90), 'vest');
});

test('Romanian counting and distance wording', () => {
  assert.equal(countWord(1, 'metru', 'metri'), '1 metru');
  assert.equal(countWord(15, 'metru', 'metri'), '15 metri');
  assert.equal(countWord(20, 'metru', 'metri'), '20 de metri');
  assert.equal(countWord(110, 'metru', 'metri'), '110 metri');
  assert.equal(countWord(120, 'metru', 'metri'), '120 de metri');
  assert.equal(formatDistance(3), 'la 5 metri');
  assert.equal(formatDistance(118), 'la 120 de metri');
  assert.equal(formatDistance(1000), 'la 1 kilometru');
  assert.equal(formatDistance(1440), 'la 1,4 kilometri');
  assert.equal(formatDistance(2000), 'la 2 kilometri');
  assert.equal(describeFrom(CENTRE, north(118)), 'la 120 de metri spre nord');
});

test('list sorts nearest first and keeps order without a position', () => {
  const items = [
    { id: 'far', ...north(900) },
    { id: 'near', ...east(50) },
    { id: 'mid', ...north(300) },
  ];
  assert.deepEqual(sortByDistance(items, CENTRE).map((i) => i.id), ['near', 'mid', 'far']);
  assert.deepEqual(sortByDistance(items, null).map((i) => i.id), ['far', 'near', 'mid']);
});
