// Einheit 14 – Quiz Linux-Server (ohne JavaScript: Antworten stehen in antworten.txt)
const test = require('node:test');
const { readAnswers, checkAnswers } = require('../antworten');

test('Quiz Linux-Server', async (t) => {
  await checkAnswers(t, readAnswers(__dirname, 'antworten.txt'), [
    { key: 'rechte-755', expect: 'rwxr-xr-x', hint: '7 = 4+2+1 = rwx, 5 = 4+1 = r-x' },
    { key: 'rechte-zahl', expect: '640', hint: 'rw- = 6, r-- = 4, --- = 0' },
    { key: 'rechte-env', expect: ['600', '0600'], hint: 'nur der Besitzer: lesen + schreiben' },
    { key: 'besitzer', expect: 'pi', hint: 'die erste der beiden Namensspalten' },
    { key: 'apt-update', expect: 'b' },
    { key: 'start-enable', expect: 'b' },
    { key: 'config-mariadb', expect: '/etc/mysql/mariadb.conf.d/50-server.cnf', hint: 'Abschnitt 7' },
    { key: 'config-grafana', expect: '/etc/grafana/grafana.ini', hint: 'Abschnitt 7' },
    { key: 'nach-aenderung', expect: 'b' },
    { key: 'cron-stunde', expect: 'b', hint: 'Minute 0, jede Stunde, jeder Tag …' },
    { key: 'cron-montag', expect: 'a', hint: 'das fünfte Feld ist der Wochentag' },
    { key: 'cron-passwort', expect: 'c' },
  ]);
});
