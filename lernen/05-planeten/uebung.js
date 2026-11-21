// Einheit 05 – Winkelrechnung wie in src/planets.js
// Prüfen: node --test "lernen/05-planeten/*.test.js"

const ZODIAC = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
const ASPECTS = [
  { name: 'conjunction', angle: 0 },
  { name: 'sextile', angle: 60 },
  { name: 'square', angle: 90 },
  { name: 'trine', angle: 120 },
  { name: 'opposition', angle: 180 },
];

// 1. Bringt jeden Winkel in den Bereich 0 (inklusive) bis 360 (exklusive).
//    norm360(370) → 10, norm360(-10) → 350, norm360(720) → 0
function norm360(deg) {
  // TODO (Achtung: % behält in JavaScript das Vorzeichen)
}

// 2. zodiacOf(237.4) → { sign: 'Scorpio', degreeInSign: 27.4 }
//    Runde degreeInSign auf 1 Nachkommastelle: Number(x.toFixed(1))
//    Benutze norm360, damit auch 365 oder -5 funktionieren.
function zodiacOf(elon) {
  // TODO
}

// 3. Kürzester Abstand zweier Längen, Ergebnis 0 bis 180.
//    separation(350, 10) → 20, separation(10, 100) → 90
function separation(a, b) {
  // TODO
}

// 4. Alle Aspekte, die bei diesem Abstand und Orbis passen, als Array von Namen.
//    aspectsFor(92, 8) → ['square'], aspectsFor(30, 8) → [], aspectsFor(30, 30) → ['conjunction', 'sextile']
//    Tipp: ASPECTS.filter(...).map(...)
function aspectsFor(sep, orb) {
  // TODO
}

// 5. Ist ein Planet rückläufig? before/after = ekliptikale Länge einen halben Tag vorher/nachher.
//    isRetrograde(100, 99.9) → true, isRetrograde(359.9, 0.1) → false (er läuft vorwärts über 0°!)
function isRetrograde(before, after) {
  // TODO
}

// 6. Mondphase aus den Längen von Sonne und Mond: wie weit ist der Mond der Sonne voraus? (0 bis 360)
//    moonPhase(100, 100) → 0 (Neumond), moonPhase(100, 280) → 180 (Vollmond), moonPhase(350, 80) → 90
function moonPhase(sunLon, moonLon) {
  // TODO
}

module.exports = { ZODIAC, ASPECTS, norm360, zodiacOf, separation, aspectsFor, isRetrograde, moonPhase };
