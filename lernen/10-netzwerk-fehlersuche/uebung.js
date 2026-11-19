// Einheit 10 – Fehler einordnen
// Prüfen: node --test lernen/10-netzwerk-fehlersuche/

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

// 4. Fallquiz: Trage den Buchstaben der richtigen Antwort ein ('a', 'b' oder 'c').
const fall = {
  // Schüler: „Setup sagt bei der Datenbank: Keine Datenbank unter 192.168.100.133:3306 erreichbar.“
  // Auf dem Pi selbst klappt `mysql -u planeten -p` aber.
  //  a) Passwort falsch   b) MariaDB lauscht nur auf 127.0.0.1   c) Pi ist aus
  eins: null, // TODO

  // Schülerin: „Grafana startet auf dem Pi nicht: address already in use.“
  //  a) Ein anderes Programm benutzt Port 3000   b) Grafana-Passwort falsch   c) Datenbank läuft nicht
  zwei: null, // TODO

  // Schüler: „Mein Dashboard ist leer, Pipeline zeigt: quakes 0, pending 0.“ Node-RED-Debug: ENOTFOUND earthquake.usgs.gov
  //  a) Die Datenbank ist voll   b) Grafana hat keine Rechte   c) Der Pi hat kein Internet / DNS
  drei: null, // TODO

  // Schülerin: „Pipeline zeigt pending 1200 und es werden nicht weniger.“
  //  a) USGS ist down   b) Teil 2 des Flows (Berechnung) läuft nicht   c) Grafana-Zeitbereich zu klein
  vier: null, // TODO

  // Schüler hat im Setup als Datenbank-Adresse 127.0.0.1 eingetragen, der Test war grün (MariaDB läuft auf
  // seinem PC in XAMPP), aber Node-RED auf dem Pi schreibt nichts.
  //  a) Node-RED auf dem Pi sucht die Datenbank auf dem Pi selbst   b) Das Passwort ist zu kurz   c) Port 3306 ist falsch
  fuenf: null, // TODO
};

module.exports = { isLoopback, layerOf, nextCheck, fall };
