// Tests for the heliocentric positions (solar system seen from above): node --test src/
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSky } = require('./planets');
const { readAsset } = require('../shared/assets');
const { ADDED_COLUMNS } = require('../setup-wizard/lib/db');

const sky = computeSky(new Date('2026-11-24T11:06:00Z'), { latitude: -20, longitude: 57 }, { riseSet: false });
const body = (name) => sky.bodies.find((b) => b.body === name);
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('every body except the Sun has a heliocentric position', () => {
  assert.equal(body('Sun').heliocentric, null);
  for (const b of sky.bodies.filter((x) => x.body !== 'Sun')) {
    const h = b.heliocentric;
    assert.ok(h.longitudeDeg >= 0 && h.longitudeDeg < 360, b.body);
    assert.ok(h.distanceAU > 0, b.body);
  }
});

test('distances from the Sun are where the orbits are', () => {
  const range = { Mercury: [0.30, 0.47], Venus: [0.71, 0.73], Mars: [1.38, 1.67], Jupiter: [4.9, 5.5],
    Saturn: [9.0, 10.1], Uranus: [18.2, 20.1], Neptune: [29.8, 30.4], Pluto: [29.6, 49.4] };
  for (const [name, [lo, hi]] of Object.entries(range)) {
    const d = body(name).heliocentric.distanceAU;
    assert.ok(d >= lo && d <= hi, `${name}: ${d} AU`);
  }
});

test('Earth = opposite the Sun: the Moon (next to Earth) is at the Sun\'s longitude + 180°', () => {
  const earthLon = (body('Sun').ecliptic.longitudeDeg + 180) % 360;
  assert.ok(angleDiff(body('Moon').heliocentric.longitudeDeg, earthLon) < 0.5);
  assert.ok(Math.abs(body('Moon').heliocentric.distanceAU - body('Sun').equatorial.distanceAU) < 0.003);
});

test('outer planets: almost the same longitude from the Sun and from the Earth', () => {
  // the farther away, the smaller the difference (parallax of the Earth's orbit)
  assert.ok(angleDiff(body('Neptune').heliocentric.longitudeDeg, body('Neptune').ecliptic.longitudeDeg) < 2);
  assert.ok(angleDiff(body('Pluto').heliocentric.longitudeDeg, body('Pluto').ecliptic.longitudeDeg) < 2);
});

test('every column the wizard adds to old tables is also in db/schema.sql', () => {
  const schema = readAsset('db/schema.sql');
  for (const [table, column] of ADDED_COLUMNS) {
    const create = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\) ENGINE`))[1];
    assert.match(create, new RegExp(`^\\s+${column}\\s`, 'm'), `${table}.${column}`);
  }
});
