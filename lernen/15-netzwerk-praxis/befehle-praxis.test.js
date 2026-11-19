// Einheit 15 – Firewall und Tests (ohne JavaScript: Antworten stehen in befehle.txt).
// Die Muster erlauben die üblichen Varianten (mit/ohne sudo, "proto tcp" vorne oder hinten).
const test = require('node:test');
const { readAnswers, checkAnswers } = require('../antworten');

const SUDO = '(sudo\\s+)?';
const NET = '192\\.168\\.100\\.0\\/24';
// ufw allow [proto tcp] from NETZ to any port PORT [proto tcp]
const allowFromNet = (port, needProto = false) => new RegExp(
  `^${SUDO}ufw${needProto ? '(?=.*\\sproto\\s+tcp(\\s|$))' : ''}\\s+allow\\s+(proto\\s+tcp\\s+)?from\\s+${NET}\\s+to\\s+any\\s+port\\s+${port}(\\s+proto\\s+tcp)?$`);

test('Firewall und Tests', async (t) => {
  await checkAnswers(t, readAnswers(__dirname, 'befehle.txt'), [
    { key: 'ufw-eingehend-verbieten', expect: new RegExp(`^${SUDO}ufw\\s+default\\s+deny(\\s+incoming)?$`) },
    { key: 'ufw-ausgehend-erlauben', expect: new RegExp(`^${SUDO}ufw\\s+default\\s+allow\\s+outgoing$`) },
    { key: 'ufw-ssh', expect: allowFromNet('22'), hint: 'ufw allow from <netz> to any port <port> proto tcp' },
    { key: 'ufw-nodered', expect: allowFromNet('1880:1899', true), hint: 'Bereiche schreibt man 1880:1899, und bei Bereichen ist proto tcp Pflicht' },
    { key: 'ufw-grafana', expect: allowFromNet('3000') },
    { key: 'ufw-mariadb', expect: allowFromNet('3306') },
    { key: 'ufw-einschalten', expect: new RegExp(`^${SUDO}ufw\\s+enable$`) },
    { key: 'ufw-anzeigen', expect: new RegExp(`^${SUDO}ufw\\s+status\\s+numbered$`) },
    { key: 'ufw-loeschen', expect: new RegExp(`^${SUDO}ufw\\s+delete\\s+3$`) },
    { key: 'test-linux', expect: /^nc\s+-(?=[a-z]*z)[a-z]+\s+192\.168\.100\.133\s+3000$/, hint: 'nc -zv <ip> <port>' },
    { key: 'test-windows', expect: /^(test-netconnection|tnc)\s+(-computername\s+)?192\.168\.100\.133\s+-port\s+3000$/i, hint: 'Test-NetConnection <ip> -Port <port>' },
    { key: 'mac-adresse', expect: /^(ip\s+(link|a|addr|address)(\s+show)?|ifconfig)$/, hint: 'ip link' },
  ]);
});
