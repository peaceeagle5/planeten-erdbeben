const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

// Nachgebautes fetch: antwortet nach 10 ms mit den gegebenen Daten
const fakeFetch = (data, status = 200) => async (url) => {
  await new Promise((r) => setTimeout(r, 10));
  if (url !== m.FEED) throw new Error(`falsche URL: ${url}`);
  return { ok: status >= 200 && status < 300, status, json: async () => data };
};
const feed = { features: [4.6, 5.0, 6.3, 4.9, 7.1].map((mag) => ({ properties: { mag } })) };

test('1. wait wartet wirklich', async () => {
  const p = m.wait(50);
  assert.ok(p instanceof Promise, 'wait muss ein Promise zurückgeben');
  const start = Date.now();
  await p;
  assert.ok(Date.now() - start >= 45, 'wait hat nicht lange genug gewartet');
});

test('2. countStrongQuakes', async () => {
  assert.equal(await m.countStrongQuakes(fakeFetch(feed), 5), 3);
  assert.equal(await m.countStrongQuakes(fakeFetch(feed), 7), 1);
  await assert.rejects(m.countStrongQuakes(fakeFetch(null, 503), 5), /HTTP 503/, 'res.ok prüfen und werfen');
});

test('3. safeCount wirft nie', async () => {
  assert.deepEqual(await m.safeCount(fakeFetch(feed), 6), { ok: true, count: 2 });
  assert.deepEqual(await m.safeCount(fakeFetch(null, 500), 6), { ok: false, message: 'HTTP 500' });
  const offline = async () => { throw new Error('fetch failed'); };
  assert.deepEqual(await m.safeCount(offline, 6), { ok: false, message: 'fetch failed' });
});

test('4. runAllChecks läuft gleichzeitig', async () => {
  const slow = (value) => async () => { await new Promise((r) => setTimeout(r, 100)); return value; };
  const start = Date.now();
  const result = await m.runAllChecks([slow('db ok'), slow('nodered ok'), slow('grafana ok')]);
  const took = Date.now() - start;
  assert.deepEqual(result, ['db ok', 'nodered ok', 'grafana ok']);
  assert.ok(took < 250, `dauerte ${took} ms: laufen die Checks nacheinander statt gleichzeitig?`);
});

test('5. runInOrder läuft nacheinander und reicht Ergebnisse weiter', async () => {
  const log = [];
  const step = (name, ms) => async (prev) => {
    log.push(`start ${name}`);
    await new Promise((r) => setTimeout(r, ms));
    log.push(`ende ${name}`);
    return (prev ?? 0) + 1;
  };
  const result = await m.runInOrder([step('db', 30), step('nodered', 10), step('grafana', 5)]);
  assert.equal(result, 3, 'Jeder Schritt soll das Ergebnis des vorherigen bekommen');
  assert.deepEqual(log, ['start db', 'ende db', 'start nodered', 'ende nodered', 'start grafana', 'ende grafana'],
    'Ein Schritt hat begonnen, bevor der vorherige fertig war');
});
