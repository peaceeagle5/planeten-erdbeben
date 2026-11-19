// Einheit 00 – Musterlösung
const antworten = {
  portGrafana: 3000,
  portDatenbank: 3306,
  portNodeRed: 1880,
  eventsProBeben: 2, // das echte Beben + ein Kontroll-Event
  positionenProEvent: 10, // Sonne, Mond, Merkur, Venus, Mars, Jupiter, Saturn, Uranus, Neptun, Pluto
  werSchreibt: 'nodered',
  werZeigtAn: 'grafana',
  zeitzone: 'UTC',
  setupLaeuftDauerhaft: false, // nur zum Einrichten
};

module.exports = { antworten };
