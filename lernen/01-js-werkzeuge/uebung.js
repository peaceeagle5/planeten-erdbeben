// Einheit 01 – JavaScript-Werkzeuge
// Ersetze jedes TODO. Prüfen: node --test lernen/01-js-werkzeuge/

// 1. Template-String
// formatFood({ name: 'Apple', calories: 52 }) → "Apple: 52 kcal"
function formatFood(food) {
  // TODO: benutze einen Template-String mit Backticks
}

// 2. Destructuring im Parameter
// Gibt "Banana hat 1.1 g Eiweiß" zurück.
// Schreibe den Parameter als { name, protein } statt food.
function describeProtein(food) {
  // TODO
}

// 3. Array-Destructuring
// USGS liefert coordinates als [Längengrad, Breitengrad, Tiefe in km].
// toPlace([142.37, 38.29, 24.5]) → { lat: 38.29, lon: 142.37, depthKm: 24.5 }
function toPlace(coordinates) {
  // TODO: const [lon, lat, depth] = ...
}

// 4. ?? statt ||
// Gibt die Tiefe zurück, oder 10, wenn keine Tiefe angegeben ist (null/undefined).
// Achtung: 0 ist eine gültige Tiefe!
function depthOrDefault(depth) {
  // TODO
}

// 5. ?. und ??
// feature ist ein USGS-Objekt wie { properties: { place: 'Japan', mag: 6.1 } }.
// Gibt den Ort zurück, oder 'unbekannt', wenn feature, properties oder place fehlen.
function placeOf(feature) {
  // TODO
}

// 6. Spread bei Arrays
// Gibt ein NEUES Array mit dem zusätzlichen Element zurück. Das Original darf sich nicht ändern.
function addFood(list, food) {
  // TODO
}

// 7. Spread bei Objekten
// withCalories({ name: 'Apple', calories: 52 }, 50) → { name: 'Apple', calories: 50 }
// Das Original darf sich nicht ändern.
function withCalories(food, calories) {
  // TODO
}

// 8. Ternärer Operator + map
// strengthLabels([4.6, 6.2, 7.1]) → ['mittel', 'stark', 'sehr stark']
// Regeln: unter 6 → 'mittel', 6 bis unter 7 → 'stark', ab 7 → 'sehr stark'
function strengthLabels(magnitudes) {
  // TODO: magnitudes.map(m => ... ? ... : ... ? ... : ...)
}

module.exports = { formatFood, describeProtein, toPlace, depthOrDefault, placeOf, addFood, withCalories, strengthLabels };
