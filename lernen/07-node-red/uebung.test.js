const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

// Nachbau des "node"-Objekts im Function-Node
function fakeNode() {
  const n = { warnings: [], statuses: [] };
  n.warn = (text) => n.warnings.push(text);
  n.status = (s) => n.statuses.push(s);
  return n;
}
const feed = {
  features: [
    { id: 'a', properties: { mag: 4.8, place: 'Chile' } },
    { id: 'b', properties: { mag: 6.1, place: 'Japan' } },
    { id: 'c', properties: { mag: 5.2, place: 'Alaska' } },
  ],
};

test('1. addTimestamp', () => {
  const msg = { payload: 1, topic: 'x' };
  const out = m.addTimestamp(msg, fakeNode());
  assert.ok(out, 'msg zurückgeben, sonst geht die Nachricht verloren');
  assert.match(out.receivedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(out.payload, 1, 'payload soll erhalten bleiben');
});

test('2. onlyStrong', () => {
  assert.deepEqual(m.onlyStrong({ payload: 5.5 }, fakeNode()), { payload: 5.5 });
  assert.deepEqual(m.onlyStrong({ payload: 5 }, fakeNode()), { payload: 5 });
  assert.equal(m.onlyStrong({ payload: 4.9 }, fakeNode()), null, 'Zum Stoppen null zurückgeben');
});

test('3. splitFeatures', () => {
  const node = fakeNode();
  const out = m.splitFeatures({ payload: feed }, node);
  assert.ok(Array.isArray(out) && Array.isArray(out[0]), 'Mehrere Nachrichten aus EINEM Ausgang: return [ [m1, m2, …] ]');
  assert.deepEqual(out[0].map((x) => x.payload), [{ id: 'a', mag: 4.8 }, { id: 'b', mag: 6.1 }, { id: 'c', mag: 5.2 }]);
  assert.deepEqual(node.statuses.at(-1), { text: '3 Beben' });
});

test('4. toInsert', () => {
  const out = m.toInsert({ quake: { id: 'us7000abcd', mag: 6.1, place: 'Japan' }, payload: 'alt' }, fakeNode());
  assert.equal(out.topic, 'INSERT IGNORE INTO events (source_id, magnitude, place) VALUES (?,?,?)');
  assert.deepEqual(out.payload, ['us7000abcd', 6.1, 'Japan']);
});

test('5. routeByMagnitude', () => {
  const strong = { payload: 6.4 };
  const weak = { payload: 4.6 };
  assert.deepEqual(m.routeByMagnitude(strong, fakeNode()), [strong, null]);
  assert.deepEqual(m.routeByMagnitude(weak, fakeNode()), [null, weak]);
  const node = fakeNode();
  const bad = m.routeByMagnitude({ payload: NaN }, node);
  assert.ok(!bad || (bad[0] == null && bad[1] == null), 'Ungültige Zahl: an keinen Ausgang etwas schicken');
  assert.deepEqual(node.warnings, ['Ungültige Magnitude']);
});

test('6. summary', () => {
  assert.equal(m.summary({ payload: feed }, fakeNode()).payload, '3 Beben, stärkstes: M6.1 bei Japan');
  assert.equal(m.summary({ payload: { features: [] } }, fakeNode()).payload, 'Keine Beben');
});
