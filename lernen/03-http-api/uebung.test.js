const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('1. parseNumber', () => {
  assert.equal(m.parseNumber('52.5', 'lat', -90, 90), 52.5);
  assert.equal(typeof m.parseNumber('7', 'x', 0, 10), 'number', 'Zahl zurückgeben, nicht den Text');
  assert.throws(() => m.parseNumber(null, 'lat', -90, 90), /Missing parameter: lat/);
  assert.throws(() => m.parseNumber('', 'lat', -90, 90), /Missing parameter: lat/);
  assert.throws(() => m.parseNumber('abc', 'lat', -90, 90), /Invalid lat/);
  assert.throws(() => m.parseNumber('200', 'lat', -90, 90), /Invalid lat/, '200 liegt außerhalb von -90..90');
  assert.equal(m.parseNumber('-90', 'lat', -90, 90), -90, 'Grenzen sind erlaubt');
});

test('2. readPlace', () => {
  assert.deepEqual(m.readPlace('http://x/api/sky?lat=52.5&lon=13.4'), { latitude: 52.5, longitude: 13.4 });
  assert.throws(() => m.readPlace('http://x/api/sky?lat=52.5'), /Missing parameter: lon/);
  assert.throws(() => m.readPlace('http://x/api/sky?lat=52.5&lon=500'), /Invalid lon/);
});

test('3. statusFor', () => {
  assert.equal(m.statusFor('GET', '/health'), 200);
  assert.equal(m.statusFor('GET', '/api/sky'), 200);
  assert.equal(m.statusFor('GET', '/api/skyy'), 404);
  assert.equal(m.statusFor('POST', '/api/sky'), 405, 'Methode zuerst prüfen');
});

test('4. skyUrl', () => {
  assert.equal(
    m.skyUrl('http://localhost:3001', 38.29, 142.37, '2026-11-18T03:12:45Z'),
    'http://localhost:3001/api/sky?lat=38.29&lon=142.37&date=2026-11-18T03%3A12%3A45Z',
  );
});

test('5. makeResponse', () => {
  const r = m.makeResponse(400, { error: 'Invalid lat' });
  assert.equal(r.status, 400);
  assert.equal(r.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(typeof r.body, 'string', 'body muss Text sein: JSON.stringify');
  assert.deepEqual(JSON.parse(r.body), { error: 'Invalid lat' });
});
