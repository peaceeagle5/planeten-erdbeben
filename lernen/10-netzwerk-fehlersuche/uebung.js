// Einheit 10 – Fehler einordnen
// Prüfen: node --test "lernen/10-netzwerk-fehlersuche/*.test.js"

// 1. Zeigt die Adresse auf "diesen Rechner"?
//    true für 'localhost', '::1' und alles, was mit '127.' beginnt. Groß-/Kleinschreibung egal.
function isLoopback(host) {
  // TODO
}

// 2. Ordnet einen Fehler einer Schicht aus Abschnitt 3 zu (1 bis 5).
//    error ist entweder ein Text-Code ('ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', …) oder ein HTTP-Status (Zahl).
//    Schicht 1: ETIMEDOUT, EHOSTUNREACH, ENOTFOUND
//    Schicht 2: ECONNREFUSED
//    Schicht 3: 404
//    Schicht 4: 401, ER_ACCESS_DENIED_ERROR
//    Schicht 5: 403, ER_HOST_NOT_PRIVILEGED, ER_DBACCESS_DENIED_ERROR
//    Unbekannt: null
function layerOf(error) {
  // TODO: ein Objekt als Nachschlagetabelle ist hier übersichtlicher als viele if
}

// 3. Der nächste Prüfschritt als Text, passend zur Schicht:
//    1 → 'ping', 2 → 'port', 3 → 'curl', 4 → 'login', 5 → 'rechte', sonst 'log'
function nextCheck(error) {
  // TODO: benutze layerOf
}

module.exports = { isLoopback, layerOf, nextCheck };
// Das Fall-Quiz steht in quiz.txt (ohne Programmieren).
