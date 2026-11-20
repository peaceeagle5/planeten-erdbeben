const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('1. interpolate', () => {
  assert.equal(
    m.interpolate("WHERE body = '$body' AND magnitude >= $minmag", { body: 'Moon', minmag: 5 }),
    "WHERE body = 'Moon' AND magnitude >= 5");
  assert.equal(m.interpolate('uid = ${ds}', { ds: 'abc' }), 'uid = abc', '${name} auch ersetzen');
  assert.equal(m.interpolate('x = $unknown', {}), 'x = $unknown', 'Unbekannte Variablen bleiben stehen');
});

test('2. expandTimeFilter', () => {
  const from = new Date('2025-01-01T00:00:00Z');
  const to = new Date('2025-12-31T23:59:59Z');
  assert.equal(
    m.expandTimeFilter('SELECT * FROM events WHERE $__timeFilter(time_utc)', from, to),
    "SELECT * FROM events WHERE time_utc BETWEEN '2025-01-01 00:00:00' AND '2025-12-31 23:59:59'");
});

test('3. loadQueries mit der echten queries.sql', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', '..', 'grafana', 'queries.sql'), 'utf8');
  const q = m.loadQueries(text);
  assert.deepEqual(Object.keys(q).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'Es gibt 9 Abfragen');
  assert.match(q[1], /^SELECT time_utc AS time/);
  assert.ok(!q[1].endsWith(';'), 'Das ; am Ende entfernen');
  assert.ok(!/^--/m.test(q[2]), 'Keine Kommentarzeilen in der Abfrage');
  assert.match(q[7], /FROM events$/);
});

test('4. makePanel', () => {
  assert.deepEqual(m.makePanel(3, 'Beben pro Tag', 'timeseries', 'SELECT 1'), {
    id: 3, title: 'Beben pro Tag', type: 'timeseries',
    targets: [{ refId: 'A', rawSql: 'SELECT 1', format: 'table', rawQuery: true }],
  });
});
