// Einheit 15 – Subnetze und Adressen (ohne JavaScript: Antworten stehen in antworten.txt)
const test = require('node:test');
const { readAnswers, checkAnswers } = require('../antworten');

test('Subnetze und Adressen', async (t) => {
  await checkAnswers(t, readAnswers(__dirname, 'antworten.txt'), [
    { key: 'netz-24', expect: '192.168.100.0', hint: 'bei /24: die ersten drei Zahlen, dann 0' },
    { key: 'broadcast-24', expect: '192.168.100.255' },
    { key: 'hosts-24', expect: '254', hint: '2^8 − 2' },
    { key: 'maske-24', expect: '255.255.255.0' },
    { key: 'maske-26', expect: '255.255.255.192', hint: '24 + 2 Bit: 128 + 64' },
    { key: 'hosts-26', expect: '62', hint: '2^6 − 2' },
    { key: 'netz-26', expect: '192.168.100.128', hint: 'Blöcke zu 64: 0, 64, 128, 192 – in welchem liegt 133?' },
    { key: 'broadcast-26', expect: '192.168.100.191', hint: 'letzte Adresse des Blocks 128–191' },
    { key: 'gleich-1', expect: 'ja' },
    { key: 'gleich-2', expect: 'nein', hint: 'bei /24 müssen die ersten drei Zahlen gleich sein' },
    { key: 'gleich-3', expect: 'ja', hint: 'bei /16 zählen nur die ersten zwei Zahlen' },
    { key: 'privat-1', expect: 'ja' },
    { key: 'privat-2', expect: 'nein', hint: 'ein öffentlicher DNS-Server' },
    { key: 'privat-3', expect: 'ja', hint: 'privat ist 172.16 bis 172.31' },
    { key: 'privat-4', expect: 'nein', hint: 'privat ist 172.16 bis 172.31' },
    { key: 'apipa', expect: 'b' },
    { key: 'reservierung', expect: 'b' },
    { key: 'default-deny', expect: 'b' },
    { key: 'ssh-zuerst', expect: 'a' },
    { key: 'docker-ufw', expect: 'b', hint: 'Abschnitt 8, letzter Punkt' },
  ]);
});
