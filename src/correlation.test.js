// Tests for the correlation finder: node --test src/
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('./correlation');

const DAY = 24 * 3600 * 1000;
let seq = 0;
/** A quake and its control. moonPhase values for quake and control. */
function pair({ q, ctl, time = Date.UTC(2025, 0, 1) + (seq * 7 * DAY), lat = (seq * 37) % 140 - 70, lon = (seq * 83) % 340 - 170, mag = 5.5 }) {
  seq++;
  const id = `us${seq}`;
  const body = (alt, eclLon, dist, helioDist) => ({ alt, eclLon, dist, helioDist });
  const bodies = (phase) => ({ Sun: body(10, 0, 1, null), Moon: body(phase - 90, phase, 0.0026, 1) });
  return [
    { kind: 'earthquake', sourceId: id, pairedWith: null, time, lat, lon, mag, moonPhase: q, bodies: bodies(q) },
    { kind: 'control', sourceId: `ctrl-${id}`, pairedWith: id, time: time - 400 * DAY, lat, lon, mag, moonPhase: ctl, bodies: bodies(ctl) },
  ];
}

test('statistics helpers', () => {
  assert.ok(Math.abs(c.chiSquareP(14.07, 7) - 0.05) < 0.001, 'critical value at 5 % for 7 df');
  assert.ok(Math.abs(c.chiSquareP(3.84, 1) - 0.05) < 0.001);
  assert.ok(Math.abs(c.normalP(1.96) - 0.05) < 0.001);
  assert.equal(c.separation(350, 10), 20);
  assert.equal(c.separation(10, 190), 180);
  assert.ok(Math.abs(c.distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111.2) < 0.5);
});

test('no effect: shares equal, nothing significant', () => {
  const rows = [];
  for (let i = 0; i < 600; i++) rows.push(...pair({ q: (i * 47) % 360, ctl: (i * 47 + 180) % 360 }));
  const r = c.compare(rows, { metric: 'moon-phase', step: 30, declustered: false });
  assert.equal(r.quakes, 600);
  assert.equal(r.bins.length, 12);
  assert.ok(r.p > 0.05, `p = ${r.p}`);
  for (const b of r.bins) assert.ok(b.pAdjusted > 0.05);
});

test('a real "+20 %": more quakes at 30-60°, found and measured', () => {
  const rows = [];
  // controls evenly spread; quakes: one in four bins of 30-60° extra
  for (let i = 0; i < 3600; i++) rows.push(...pair({ q: i % 5 === 0 ? 45 : (i * 37) % 360, ctl: (i * 53) % 360 }));
  const r = c.compare(rows, { metric: 'moon-phase', step: 30, declustered: false });
  const hit = c.strongest(r);
  assert.equal(hit.bin, '30…60°');
  assert.ok(hit.diffPct > 100, `diff ${hit.diffPct}`);
  assert.ok(hit.pAdjusted < 0.001);
  assert.ok(r.p < 0.001);
});

test('aftershocks: a cluster of 40 quakes counts once after declustering', () => {
  const rows = [];
  for (let i = 0; i < 300; i++) rows.push(...pair({ q: (i * 37) % 360, ctl: (i * 53) % 360 }));
  const main = Date.UTC(2026, 5, 1);
  for (let k = 0; k < 40; k++) rows.push(...pair({ q: 95 + k * 0.1, ctl: (k * 91) % 360, time: main + k * 3600 * 1000, lat: 38, lon: 142, mag: k === 0 ? 7.5 : 5 }));
  const raw = c.compare(rows, { metric: 'moon-phase', step: 30, declustered: false });
  const clean = c.compare(rows, { metric: 'moon-phase', step: 30 });
  assert.equal(raw.quakes, 340);
  assert.equal(clean.quakes, 301, 'cluster -> its main shock');
  const bin = (r) => r.bins.find((b) => b.bin === '90…120°');
  assert.ok(bin(raw).pAdjusted < 0.01, 'looks like a strong effect with aftershocks');
  assert.ok(bin(clean).pAdjusted > 0.05, 'gone without them');
});

test('quantile bins for distances, metrics per body, skipped values counted', () => {
  const rows = [];
  for (let i = 0; i < 500; i++) rows.push(...pair({ q: (i * 37) % 360, ctl: (i * 53) % 360 }));
  const r = c.compare(rows, { metric: 'altitude', body: 'Moon', step: 30, declustered: false });
  assert.deepEqual(r.bins.map((b) => b.bin), ['-90…-60°', '-60…-30°', '-30…0°', '0…30°', '30…60°', '60…90°']);
  const d = c.compare(rows, { metric: 'dist-sun', body: 'Sun', declustered: false });
  assert.equal(d.bins.length, 5);
  assert.equal(d.bins[0].bin, 'nearest 20 %');
  const helio = c.compare(rows, { metric: 'dist-sun', body: 'Mars', declustered: false });
  assert.equal(helio.skipped, 500, 'Mars has no values in this test data');
  assert.ok(!c.combinations().some((x) => x.metric === 'sun-angle' && x.body === 'Sun'));
});

test('scan corrects for the number of tests; replicate checks a second period', () => {
  const rows = [];
  for (let i = 0; i < 400; i++) rows.push(...pair({ q: (i * 37) % 360, ctl: (i * 53) % 360, time: Date.UTC(2025, 0, 1) + i * DAY }));
  const s = c.scan(rows, { step: 30, declustered: false });
  assert.equal(s.tests, 34, 'Moon: altitude 6 + phase 12 + Sun angle 6 + distance 5, Mercury distance from the Sun 5');
  for (const r of s.results) assert.ok(r.pAll >= (r.best?.p ?? 1));
  const periods = [{ from: Date.UTC(2025, 0, 1), to: Date.UTC(2025, 6, 1) }, { from: Date.UTC(2025, 6, 1), to: Date.UTC(2026, 3, 1) }];
  const rep = c.replicate(rows, { metric: 'moon-phase', step: 30, declustered: false }, periods);
  assert.equal(rep.confirmed, false, 'chance patterns do not come back');
});

test('fair only when the data covers several cycles: Moon yes, Saturn no', () => {
  const rows = [];
  for (let i = 0; i < 400; i++) rows.push(...pair({ q: (i * 37) % 360, ctl: (i * 53) % 360, time: Date.UTC(2025, 0, 1) + i * 1.7 * DAY }));
  assert.equal(c.compare(rows, { metric: 'moon-phase', declustered: false }).fair, true);
  const saturn = c.compare(rows, { metric: 'dist-earth', body: 'Saturn', declustered: false });
  assert.equal(saturn.fair, false);
  assert.ok(saturn.cycleDays > 370);
  const s = c.scan(rows, { declustered: false });
  assert.ok(s.unfair.some((u) => u.body === 'Saturn'));
  assert.ok(s.results.every((r) => r.result.fair));
});

test('declustering: weaker quakes near a stronger one drop out, distant or later ones stay', () => {
  const t = Date.UTC(2026, 0, 1);
  const q = (mag, hours, lat, lon) => ({ kind: 'earthquake', sourceId: `${mag}-${hours}-${lat}`, mag, time: t + hours * 3600 * 1000, lat, lon });
  const list = [q(7, 0, 38, 142), q(6, 10, 38.5, 142.5), q(6, 10, -20, -70), q(5, 100, 38, 142)];
  assert.deepEqual(c.decluster(list).map((x) => x.sourceId), ['7-0-38', '6-10--20', '5-100-38']);
});

