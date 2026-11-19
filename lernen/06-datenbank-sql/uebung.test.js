const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('1. isSafeName', () => {
  assert.equal(m.isSafeName('planeten_erdbeben'), true);
  assert.equal(m.isSafeName('Klasse10b'), true);
  assert.equal(m.isSafeName('x; DROP TABLE events'), false);
  assert.equal(m.isSafeName(''), false, 'Leer ist nicht erlaubt');
  assert.equal(m.isSafeName('a'.repeat(65)), false, 'Höchstens 64 Zeichen');
  assert.equal(m.isSafeName('db-name'), false, 'Bindestrich ist nicht erlaubt');
});

test('2. buildInsert', () => {
  assert.deepEqual(m.buildInsert('aspects', ['event_id', 'aspect'], [[1, 'square'], [1, 'trine']]), {
    sql: 'INSERT INTO aspects (event_id,aspect) VALUES (?,?),(?,?)',
    params: [1, 'square', 1, 'trine'],
  });
  const one = m.buildInsert('events', ['a', 'b', 'c'], [[1, 2, 3]]);
  assert.equal((one.sql.match(/\?/g) || []).length, one.params.length, 'Anzahl ? und Werte muss gleich sein');
  assert.throws(() => m.buildInsert('events; DROP TABLE x', ['a'], [[1]]), 'Unsichere Tabellennamen ablehnen');
});

test('3. SQL-Injection verstehen', () => {
  assert.ok(m.ANGRIFF.length > 0, 'ANGRIFF ist noch leer');
  const sql = m.unsafeQuery(m.ANGRIFF);
  assert.match(sql, /;\s*DROP TABLE events\s*;/, `Dein Befehl: ${sql}`);
  const afterDrop = sql.split(/DROP TABLE events\s*;/)[1];
  assert.match(afterDrop, /^\s*--/, `Nach dem DROP bleibt noch ausführbarer Text übrig (Tipp: --): ${sql}`);
});

test('4. shares', () => {
  assert.deepEqual(m.shares([{ group: 'Neumond', n: 1 }, { group: 'Vollmond', n: 3 }]),
    [{ group: 'Neumond', pct: 25 }, { group: 'Vollmond', pct: 75 }]);
  assert.deepEqual(m.shares([{ group: 'a', n: 1 }, { group: 'b', n: 2 }]),
    [{ group: 'a', pct: 33.3 }, { group: 'b', pct: 66.7 }]);
  assert.deepEqual(m.shares([{ group: 'a', n: 0 }]), [{ group: 'a', pct: 0 }], 'Nicht durch 0 teilen');
});
