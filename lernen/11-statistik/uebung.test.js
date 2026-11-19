const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: erwartet ${b}, bekommen ${a}`);

test('1. countBy', () => {
  assert.deepEqual(m.countBy(['Leo', 'Aries', 'Leo']), { Leo: 2, Aries: 1 });
  assert.deepEqual(m.countBy([]), {});
});

test('2. expectedCounts', () => {
  assert.deepEqual(m.expectedCounts({ a: 30, b: 10 }, 100), { a: 75, b: 25 });
  assert.deepEqual(m.expectedCounts({ x: 1, y: 1, z: 2 }, 8), { x: 2, y: 2, z: 4 });
});

test('3. chiSquare', () => {
  close(m.chiSquare({ a: 80, b: 20 }, { a: 75, b: 25 }), 25 / 75 + 25 / 25, 'Beispiel aus der Aufgabe');
  close(m.chiSquare({ a: 75, b: 25 }, { a: 75, b: 25 }), 0, 'Keine Abweichung = 0');
  close(m.chiSquare({ a: 10 }, { a: 5, b: 5 }), 25 / 5 + 25 / 5, 'Fehlende Gruppe zählt als 0');
});

test('4. isSignificant', () => {
  assert.equal(m.isSignificant(15, 8), true, '8 Gruppen = 7 Freiheitsgrade, kritisch 14.07');
  assert.equal(m.isSignificant(10, 8), false);
  assert.equal(m.isSignificant(4, 2), true);
  assert.throws(() => m.isSignificant(5, 6), 'Für 5 Freiheitsgrade gibt es keinen Wert in der Tabelle');
});

test('5. expectedFalseAlarms', () => {
  assert.equal(m.expectedFalseAlarms(100), 5);
  assert.equal(m.expectedFalseAlarms(120), 6, '10 Körper × 12 Zeichen');
  close(m.expectedFalseAlarms(225, 0.01), 2.25, 'mit anderem Niveau');
});

test('6. phaseGroup', () => {
  assert.equal(m.phaseGroup(0), 0);
  assert.equal(m.phaseGroup(350), 0, '350° ist noch Neumond (ab 337,5°)');
  assert.equal(m.phaseGroup(22.4), 0);
  assert.equal(m.phaseGroup(22.5), 1);
  assert.equal(m.phaseGroup(180), 4);
  assert.equal(m.phaseGroup(337.4), 7);
});
