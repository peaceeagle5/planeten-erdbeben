// Einheit 00 – Quiz (ohne JavaScript: Antworten stehen in antworten.txt)
const test = require('node:test');
const { readAnswers, checkAnswers } = require('../antworten');

test('Quiz zum Gesamtbild', async (t) => {
  await checkAnswers(t, readAnswers(__dirname, 'antworten.txt'), [
    { key: 'port-grafana', expect: '3000', hint: 'Standard-Port, auch im Setup-Assistenten vorausgefüllt' },
    { key: 'port-datenbank', expect: '3306' },
    { key: 'port-nodered', expect: '1880', hint: 'Im Labor hat jede:r einen eigenen, der Standard ist aber …' },
    { key: 'events-pro-beben', expect: '2', hint: 'Es gibt echte Beben und Kontroll-Events' },
    { key: 'positionen-pro-event', expect: '10', hint: 'Sonne + Mond + 8 Planeten' },
    { key: 'wer-schreibt', expect: ['nodered', 'node-red'] },
    { key: 'wer-zeigt-an', expect: 'grafana' },
    { key: 'zeitzone', expect: 'utc' },
    { key: 'setup-dauerhaft', expect: ['nein', 'false'], hint: 'Der Assistent richtet nur ein und kann danach beendet werden' },
  ]);
});
