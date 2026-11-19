// Einheit 00 – Quiz zum Gesamtbild
// Trage die richtigen Werte ein (Zahlen als Zahl, Texte in Anführungszeichen).
// Prüfen: node --test lernen/00-gesamtbild/

const antworten = {
  // Auf welchem Port läuft Grafana standardmäßig?
  portGrafana: null, // TODO

  // Auf welchem Port läuft MariaDB/MySQL standardmäßig?
  portDatenbank: null, // TODO

  // Auf welchem Port läuft Node-RED standardmäßig?
  portNodeRed: null, // TODO

  // Wie viele Zeilen entstehen in der Tabelle "events" pro echtem Erdbeben?
  eventsProBeben: null, // TODO

  // Wie viele Zeilen entstehen in "body_positions" pro Event? (Sonne, Mond, Merkur ... Pluto)
  positionenProEvent: null, // TODO

  // Wer schreibt in die Datenbank? "nodered" oder "grafana"
  werSchreibt: null, // TODO

  // Wer liest für die Diagramme aus der Datenbank? "nodered" oder "grafana"
  werZeigtAn: null, // TODO

  // In welcher Zeitzone sind alle Zeiten gespeichert? (drei Buchstaben)
  zeitzone: null, // TODO

  // Muss der Setup-Assistent dauerhaft laufen? true oder false
  setupLaeuftDauerhaft: null, // TODO
};

module.exports = { antworten };
