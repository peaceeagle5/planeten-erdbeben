const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');
const { computeSky } = require('../../src/planets');

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: erwartet ~${b}, bekommen ${a}`);

test('1. norm360', () => {
  assert.equal(m.norm360(10), 10);
  assert.equal(m.norm360(370), 10);
  assert.equal(m.norm360(-10), 350, '-10 % 360 ist in JavaScript -10, nicht 350');
  assert.equal(m.norm360(720), 0);
  assert.equal(m.norm360(0), 0);
});

test('2. zodiacOf', () => {
  assert.deepEqual(m.zodiacOf(237.4), { sign: 'Scorpio', degreeInSign: 27.4 });
  assert.deepEqual(m.zodiacOf(0), { sign: 'Aries', degreeInSign: 0 });
  assert.deepEqual(m.zodiacOf(359.9), { sign: 'Pisces', degreeInSign: 29.9 });
  assert.deepEqual(m.zodiacOf(365), { sign: 'Aries', degreeInSign: 5 }, '365° = 5°: vorher norm360');
  assert.deepEqual(m.zodiacOf(-5), { sign: 'Pisces', degreeInSign: 25 });
});

test('3. separation', () => {
  assert.equal(m.separation(10, 100), 90);
  assert.equal(m.separation(350, 10), 20, 'kürzerer Weg über 0°');
  assert.equal(m.separation(10, 350), 20);
  assert.equal(m.separation(0, 180), 180);
  assert.equal(m.separation(45, 45), 0);
});

test('4. aspectsFor', () => {
  assert.deepEqual(m.aspectsFor(92, 8), ['square']);
  assert.deepEqual(m.aspectsFor(30, 8), []);
  assert.deepEqual(m.aspectsFor(176, 8), ['opposition']);
  assert.deepEqual(m.aspectsFor(30, 30), ['conjunction', 'sextile'], 'Grenzen gehören dazu (<=)');
});

test('5. isRetrograde', () => {
  assert.equal(m.isRetrograde(100, 100.2), false);
  assert.equal(m.isRetrograde(100, 99.9), true);
  assert.equal(m.isRetrograde(359.9, 0.1), false, 'Vorwärts über 0°: das ist +0.2°, nicht -359.8°');
  assert.equal(m.isRetrograde(0.1, 359.9), true, 'Rückwärts über 0°');
});

test('6. moonPhase stimmt mit der echten Berechnung überein', () => {
  assert.equal(m.moonPhase(100, 100), 0);
  assert.equal(m.moonPhase(100, 280), 180);
  assert.equal(m.moonPhase(350, 80), 90, 'Über 0° hinweg: norm360 benutzen');
  for (const iso of ['2026-11-24T15:00:00Z', '2026-11-18T03:12:45Z', '2025-03-01T12:00:00Z']) {
    const sky = computeSky(new Date(iso), { latitude: 0, longitude: 0 }, { riseSet: false });
    const sun = sky.bodies.find((b) => b.body === 'Sun').ecliptic.longitudeDeg;
    const moon = sky.bodies.find((b) => b.body === 'Moon').ecliptic.longitudeDeg;
    close(m.moonPhase(sun, moon), sky.moonPhaseDeg, 0.5, `Mondphase am ${iso}`);
  }
});
