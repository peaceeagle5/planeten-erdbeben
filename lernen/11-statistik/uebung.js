// Einheit 11 – Statistik
// Prüfen: node --test "lernen/11-statistik/*.test.js"

// 1. Zählt, wie oft jede Gruppe vorkommt.
//    countBy(['Leo', 'Aries', 'Leo']) → { Leo: 2, Aries: 1 }
function countBy(values) {
  // TODO: reduce mit einem Objekt als Startwert
}

// 2. Erwartete Anzahlen: So viele Beben wären in jeder Gruppe, wenn sie wie die Kontrolle verteilt wären.
//    expectedCounts({ a: 30, b: 10 }, 100) → { a: 75, b: 25 }   (Kontrolle: a = 75 %, b = 25 %; 100 Beben)
function expectedCounts(controlCounts, total) {
  // TODO: Anteil jeder Gruppe an der Kontrolle × total
}

// 3. Chi-Quadrat: Summe über alle Gruppen von (beobachtet − erwartet)² / erwartet.
//    observed und expected sind Objekte mit denselben Schlüsseln. Fehlt eine Gruppe in observed, zählt sie als 0.
//    chiSquare({ a: 80, b: 20 }, { a: 75, b: 25 }) → 25/75 + 25/25 = 1.3333…
function chiSquare(observed, expected) {
  // TODO
}

// 4. Ist χ² signifikant bei 5 %? Freiheitsgrade = Anzahl Gruppen − 1.
//    Benutze CRITICAL. Für Freiheitsgrade, die nicht in der Tabelle stehen: throw new Error.
const CRITICAL = { 1: 3.84, 2: 5.99, 3: 7.81, 4: 9.49, 7: 14.07, 11: 19.68 };
function isSignificant(chi, groups) {
  // TODO
}

// 5. Wie viele „signifikante“ Ergebnisse erwartet man durch reinen Zufall bei so vielen Tests?
//    expectedFalseAlarms(100) → 5   (bei 5 % Irrtum)
function expectedFalseAlarms(tests, level = 0.05) {
  // TODO
}

// 6. Mondphase (0–360°) → eine von 8 Gruppen 0–7, jede 45° breit, zentriert auf die Phase:
//    Gruppe 0 = Neumond = 337,5° bis 22,5°, Gruppe 4 = Vollmond = 157,5° bis 202,5°
//    Wie in grafana/queries.sql: FLOOR(MOD(phase + 22.5, 360) / 45)
function phaseGroup(deg) {
  // TODO
}

module.exports = { countBy, expectedCounts, chiSquare, CRITICAL, isSignificant, expectedFalseAlarms, phaseGroup };
