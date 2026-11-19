// Einheit 06 – SQL sicher bauen (JavaScript-Teil)
// Prüfen: node --test lernen/06-datenbank-sql/uebung.test.js

// 1. Ist ein Name sicher als Tabellen-/Datenbankname? Nur Buchstaben A–Z/a–z, Ziffern, _ und 1 bis 64 Zeichen.
//    isSafeName('planeten_erdbeben') → true, isSafeName('x; DROP TABLE events') → false
function isSafeName(name) {
  // TODO: Regulärer Ausdruck mit .test()
}

// 2. Baut einen INSERT mit Platzhaltern, wie bulk() in node-red/functions/compute-sky.js:
//    buildInsert('aspects', ['event_id', 'aspect'], [[1, 'square'], [1, 'trine']])
//    → { sql: 'INSERT INTO aspects (event_id,aspect) VALUES (?,?),(?,?)', params: [1, 'square', 1, 'trine'] }
//    Wirf einen Error, wenn der Tabellenname nicht sicher ist (isSafeName).
function buildInsert(table, cols, rows) {
  // TODO: Tipp: cols.map(() => '?').join(','), rows.flat()
}

// 3. Die UNSICHERE Variante, nur um den Angriff zu verstehen. Nicht in echtem Code benutzen!
//    unsafeQuery("Japan") → "SELECT * FROM events WHERE place = 'Japan'"
function unsafeQuery(place) {
  return `SELECT * FROM events WHERE place = '${place}'`;
}
//    Finde eine Eingabe, die aus unsafeQuery einen Befehl macht, der die Tabelle events löscht.
//    Das Ergebnis soll "DROP TABLE events" enthalten und nach dem DROP nichts Ausführbares mehr übrig lassen.
const ANGRIFF = ''; // TODO

// 4. Prozent-Anteile wie in den Grafana-Abfragen mit SUM(...) OVER ():
//    shares([{ group: 'Neumond', n: 1 }, { group: 'Vollmond', n: 3 }])
//    → [{ group: 'Neumond', pct: 25 }, { group: 'Vollmond', pct: 75 }]
//    Runde auf 1 Nachkommastelle. Bei Summe 0 überall pct: 0.
function shares(rows) {
  // TODO: Gesamtsumme mit reduce, dann map
}

module.exports = { isSafeName, buildInsert, unsafeQuery, ANGRIFF, shares };
