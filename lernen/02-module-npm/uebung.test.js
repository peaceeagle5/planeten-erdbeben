const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

// Holt eine exportierte Funktion; fehlt der Export, kommt eine verständliche Meldung statt "is not a function".
const fn = (name) => {
  assert.equal(typeof m[name], 'function', `${name} wird noch nicht exportiert (TODO 6: module.exports)`);
  return m[name];
};

test('Exporte', () => {
  for (const name of ['calculateCalories', 'mealCalories', 'moonPhaseDeg', 'moonPhaseName']) {
    assert.equal(typeof m[name], 'function', `${name} wird nicht exportiert (module.exports prüfen)`);
  }
  assert.equal(m.HELPER, undefined, 'HELPER soll privat bleiben und nicht exportiert werden');
});

test('mealCalories mit reduce', () => {
  const meal = [{ per100g: 52, grams: 150 }, { per100g: 89, grams: 120 }];
  assert.ok(Math.abs(fn('mealCalories')(meal) - 184.8) < 1e-9, `erwartet 184.8, bekommen ${fn('mealCalories')(meal)}`);
  assert.equal(fn('mealCalories')([]), 0, 'Leere Mahlzeit = 0. Startwert bei reduce vergessen?');
});

test('moonPhaseDeg mit astronomy-engine', () => {
  // Vollmond am 24.11.2026 um 14:54 UTC, Neumond am 9.11.2026 um 07:02 UTC
  const full = fn('moonPhaseDeg')(new Date('2026-11-24T15:00:00Z'));
  const fresh = fn('moonPhaseDeg')(new Date('2026-11-09T07:00:00Z'));
  assert.ok(Number.isInteger(full), 'Bitte auf ganze Grad runden');
  assert.ok(Math.abs(full - 180) <= 2, `Vollmond sollte ~180° sein, bekommen ${full}`);
  assert.ok(fresh <= 2 || fresh >= 358, `Neumond sollte ~0° sein, bekommen ${fresh}`);
});

test('moonPhaseName', () => {
  assert.equal(fn('moonPhaseName')(10), 'Neumond');
  assert.equal(fn('moonPhaseName')(350), 'Neumond');
  assert.equal(fn('moonPhaseName')(90), 'zunehmend');
  assert.equal(fn('moonPhaseName')(180), 'Vollmond');
  assert.equal(fn('moonPhaseName')(270), 'abnehmend');
  assert.equal(fn('moonPhaseName')(45), 'zunehmend', 'Grenze 45 gehört zu zunehmend');
});
