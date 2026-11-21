// Einheit 02 – Module und npm
// Prüfen: node --test "lernen/02-module-npm/*.test.js"
//
// Der Test lädt diese Datei mit require('./uebung.js'). Er sieht nur, was du unten exportierst.

// TODO 1: Lade das npm-Paket astronomy-engine in die Konstante Astronomy.
//         (Ohne ./ davor, es liegt in node_modules.)
const Astronomy = null; // TODO

// 2. Deine Funktion aus JavaScript-Learning, unverändert
function calculateCalories(caloriesPer100g, weightInGrams) {
  return (caloriesPer100g / 100) * weightInGrams;
}

// 3. mealCalories([{ per100g: 52, grams: 150 }, { per100g: 89, grams: 120 }]) → 184.8
//    Benutze calculateCalories und reduce.
function mealCalories(items) {
  // TODO
}

// 4. Mondphase in Grad für ein Datum: 0 = Neumond, 90 = zunehmend, 180 = Vollmond, 270 = abnehmend.
//    Benutze Astronomy.MoonPhase(date). Runde auf ganze Grad (Math.round).
function moonPhaseDeg(date) {
  // TODO
}

// 5. Wandelt die Gradzahl in einen Namen um:
//    unter 45 oder ab 315 → 'Neumond', unter 135 → 'zunehmend', unter 225 → 'Vollmond', sonst 'abnehmend'
function moonPhaseName(deg) {
  // TODO
}

// TODO 6: Exportiere calculateCalories, mealCalories, moonPhaseDeg und moonPhaseName.
//         HELPER soll NICHT exportiert werden (bleibt privat).
const HELPER = 'privat';
module.exports = {}; // TODO
