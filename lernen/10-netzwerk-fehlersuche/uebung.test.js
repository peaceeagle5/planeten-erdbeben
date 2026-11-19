const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('1. isLoopback', () => {
  for (const h of ['localhost', 'LOCALHOST', '127.0.0.1', '127.0.1.1', '::1']) assert.equal(m.isLoopback(h), true, h);
  for (const h of ['192.168.100.133', '10.0.0.1', 'raspberrypi.local', '']) assert.equal(m.isLoopback(h), false, h);
});

test('2. layerOf', () => {
  assert.equal(m.layerOf('ETIMEDOUT'), 1);
  assert.equal(m.layerOf('ENOTFOUND'), 1);
  assert.equal(m.layerOf('ECONNREFUSED'), 2);
  assert.equal(m.layerOf(404), 3);
  assert.equal(m.layerOf(401), 4);
  assert.equal(m.layerOf('ER_ACCESS_DENIED_ERROR'), 4);
  assert.equal(m.layerOf(403), 5);
  assert.equal(m.layerOf('ER_HOST_NOT_PRIVILEGED'), 5);
  assert.equal(m.layerOf('EIRGENDWAS'), null);
});

test('3. nextCheck', () => {
  assert.equal(m.nextCheck('EHOSTUNREACH'), 'ping');
  assert.equal(m.nextCheck('ECONNREFUSED'), 'port');
  assert.equal(m.nextCheck(404), 'curl');
  assert.equal(m.nextCheck(401), 'login');
  assert.equal(m.nextCheck('ER_DBACCESS_DENIED_ERROR'), 'rechte');
  assert.equal(m.nextCheck(500), 'log');
});

test('4. Fallquiz', () => {
  const hints = {
    eins: 'Lokal geht es, übers Netz nicht: Wo lauscht MariaDB?',
    zwei: '„address already in use“ heißt …',
    drei: 'ENOTFOUND = ein Name kann nicht aufgelöst werden',
    vier: 'Beben kommen an (pending steigt), aber niemand rechnet',
    fuenf: '„localhost“ aus Sicht von wem?',
  };
  const expected = { eins: 'b', zwei: 'a', drei: 'c', vier: 'b', fuenf: 'a' };
  for (const k of Object.keys(expected)) assert.equal(m.fall[k], expected[k], `Fall ${k}: ${hints[k]}`);
});
