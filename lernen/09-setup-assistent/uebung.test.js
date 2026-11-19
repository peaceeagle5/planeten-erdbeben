const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('1. baseUrl', () => {
  assert.equal(m.baseUrl(' 192.168.100.133:1893/ '), 'http://192.168.100.133:1893');
  assert.equal(m.baseUrl('http://localhost:3000///'), 'http://localhost:3000');
  assert.equal(m.baseUrl('https://grafana.schule.de'), 'https://grafana.schule.de', 'https:// nicht doppeln');
});

test('2. basicAuth', () => {
  assert.equal(m.basicAuth('admin', 'geheim'), 'Basic YWRtaW46Z2VoZWlt');
});

test('3. decodeBasic: Base64 ist keine Verschlüsselung', () => {
  assert.deepEqual(m.decodeBasic('Basic YWRtaW46Z2VoZWlt'), { user: 'admin', password: 'geheim' });
  const withColon = 'Basic ' + Buffer.from('lehrer:a:b:c').toString('base64');
  assert.deepEqual(m.decodeBasic(withColon), { user: 'lehrer', password: 'a:b:c' }, 'Nur am ersten : trennen');
});

test('4. slug', () => {
  assert.equal(m.slug('Pascal B.'), 'pascal-b');
  assert.equal(m.slug('  Ä!! '), 'a');
  assert.equal(m.slug('Jürgen Müller-Lüdenscheidt aus der 10b'), 'jurgen-muller-ludenscheidt-a', 'Umlaute: ü → u, nicht u-');
  assert.equal(m.slug('!!!'), 'user');
  assert.ok(m.slug('x'.repeat(50)).length <= 28);
});

test('5. ownerFromInfo', () => {
  assert.equal(m.ownerFromInfo('Eingerichtet von: Pascal B. (2026-11-19)\n\nErstellt vom ...'), 'Pascal B.');
  assert.equal(m.ownerFromInfo('Eingerichtet von: Nachbar\nmehr Text'), 'Nachbar');
  assert.equal(m.ownerFromInfo('Erstellt vom Planeten-Erdbeben-Setup.'), null);
  assert.equal(m.ownerFromInfo(undefined), null);
});

test('6. isAllowedHost', () => {
  assert.equal(m.isAllowedHost('127.0.0.1:8790', 8790), true);
  assert.equal(m.isAllowedHost('localhost:8790', 8790), true);
  assert.equal(m.isAllowedHost('evil.example:8790', 8790), false, 'DNS-Rebinding abwehren');
  assert.equal(m.isAllowedHost('127.0.0.1:8791', 8790), false);
  assert.equal(m.isAllowedHost(undefined, 8790), false);
});

test('7. parseNdjson', () => {
  assert.deepEqual(m.parseNdjson(['{"a":1}\n{"b"', ':2}\n']), [{ a: 1 }, { b: 2 }]);
  assert.deepEqual(m.parseNdjson(['{"a":1}\n\n', '{"b":2}\n{"unvoll']), [{ a: 1 }, { b: 2 }], 'Leere Zeilen und unvollständigen Rest ignorieren');
  assert.deepEqual(m.parseNdjson(['{"type":"done"', ',"verified":true}', '\n']), [{ type: 'done', verified: true }]);
});
