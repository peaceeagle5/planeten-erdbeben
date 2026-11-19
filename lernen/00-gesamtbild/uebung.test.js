const test = require('node:test');
const assert = require('node:assert/strict');
const { antworten: a } = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('Ports', () => {
  assert.equal(a.portGrafana, 3000, 'Grafana: Standard-Port, auch im Setup-Assistenten vorausgefüllt');
  assert.equal(a.portDatenbank, 3306, 'MariaDB/MySQL: Standard-Port');
  assert.equal(a.portNodeRed, 1880, 'Node-RED: Standard-Port (bei euch hat jede:r einen eigenen)');
});

test('Datenmengen', () => {
  assert.equal(a.eventsProBeben, 2, 'Tipp: Es gibt echte Beben und Kontroll-Events');
  assert.equal(a.positionenProEvent, 10, 'Tipp: Sonne + Mond + 8 Planeten');
});

test('Wer macht was', () => {
  assert.equal(a.werSchreibt, 'nodered');
  assert.equal(a.werZeigtAn, 'grafana');
  assert.equal(a.zeitzone, 'UTC');
  assert.equal(a.setupLaeuftDauerhaft, false, 'Der Assistent richtet nur ein und kann danach beendet werden');
});
