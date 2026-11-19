// Einheit 04 – Asynchrones JavaScript
// Prüfen: node --test lernen/04-async/
//
// fetchFn verhält sich wie fetch: fetchFn(url) gibt ein Promise auf { ok, status, json() } zurück,
// und json() gibt wieder ein Promise zurück.

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';

// 1. Gibt ein Promise zurück, das nach ms Millisekunden erfüllt wird.
//    Tipp: new Promise((resolve) => setTimeout(resolve, ms))
function wait(ms) {
  // TODO
}

// 2. Holt den Feed mit fetchFn(FEED) und zählt Beben mit Magnitude >= minMag.
//    Die Magnitude steht in feature.properties.mag.
//    Wenn res.ok false ist: throw new Error(`HTTP ${res.status}`)
async function countStrongQuakes(fetchFn, minMag) {
  // TODO
}

// 3. Wie countStrongQuakes, wirft aber nie. Gibt zurück:
//    Erfolg: { ok: true, count: <Zahl> }
//    Fehler: { ok: false, message: <Fehlermeldung> }
async function safeCount(fetchFn, minMag) {
  // TODO: try / catch um countStrongQuakes
}

// 4. checks ist ein Array von async Funktionen (z. B. [testDb, testNodeRed, testGrafana]).
//    Starte alle GLEICHZEITIG und gib ein Array ihrer Ergebnisse zurück (gleiche Reihenfolge).
//    Tipp: Promise.all und map
async function runAllChecks(checks) {
  // TODO
}

// 5. steps ist ein Array von async Funktionen, die NACHEINANDER laufen müssen.
//    Jede bekommt das Ergebnis der vorherigen als Parameter (die erste bekommt undefined).
//    Gib das Ergebnis der letzten zurück.
//    Tipp: for...of mit await in der Schleife
async function runInOrder(steps) {
  // TODO
}

module.exports = { FEED, wait, countStrongQuakes, safeCount, runAllChecks, runInOrder };
