const test = require('node:test');
const assert = require('node:assert/strict');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('1. formatFood: Template-String', () => {
  assert.equal(m.formatFood({ name: 'Apple', calories: 52 }), 'Apple: 52 kcal');
  assert.equal(m.formatFood({ name: 'Mango', calories: 60 }), 'Mango: 60 kcal');
});

test('2. describeProtein: Destructuring', () => {
  assert.equal(m.describeProtein({ name: 'Banana', protein: 1.1, calories: 89 }), 'Banana hat 1.1 g Eiweiß');
});

test('3. toPlace: Array-Destructuring', () => {
  assert.deepEqual(m.toPlace([142.37, 38.29, 24.5]), { lat: 38.29, lon: 142.37, depthKm: 24.5 });
});

test('4. depthOrDefault: ?? behält die 0', () => {
  assert.equal(m.depthOrDefault(35), 35);
  assert.equal(m.depthOrDefault(null), 10);
  assert.equal(m.depthOrDefault(undefined), 10);
  assert.equal(m.depthOrDefault(0), 0, '0 km ist eine echte Tiefe. Hast du || statt ?? benutzt?');
});

test('5. placeOf: ?. und ??', () => {
  assert.equal(m.placeOf({ properties: { place: 'Japan' } }), 'Japan');
  assert.equal(m.placeOf({ properties: {} }), 'unbekannt');
  assert.equal(m.placeOf({}), 'unbekannt', 'properties fehlt ganz: ?. benutzen');
  assert.equal(m.placeOf(undefined), 'unbekannt', 'feature fehlt ganz');
});

test('6. addFood: neues Array, Original bleibt', () => {
  const original = ['Apple', 'Banana'];
  const result = m.addFood(original, 'Mango');
  assert.deepEqual(result, ['Apple', 'Banana', 'Mango']);
  assert.deepEqual(original, ['Apple', 'Banana'], 'Das Original wurde verändert. push benutzt?');
});

test('7. withCalories: neues Objekt, Original bleibt', () => {
  const apple = { name: 'Apple', calories: 52 };
  assert.deepEqual(m.withCalories(apple, 50), { name: 'Apple', calories: 50 });
  assert.equal(apple.calories, 52, 'Das Original wurde verändert');
});

test('8. strengthLabels: Ternär + map', () => {
  assert.deepEqual(m.strengthLabels([4.6, 6.2, 7.1]), ['mittel', 'stark', 'sehr stark']);
  assert.deepEqual(m.strengthLabels([6, 7]), ['stark', 'sehr stark'], 'Grenzen: 6 ist stark, 7 ist sehr stark');
  assert.deepEqual(m.strengthLabels([]), []);
});
