// Einheit 14 – Befehle (ohne JavaScript: Antworten stehen in befehle.txt).
// Die Muster erlauben die üblichen Varianten (mit/ohne sudo, -y, .service, Reihenfolge der Optionen).
const test = require('node:test');
const { readAnswers, checkAnswers } = require('../antworten');

const SUDO = '(sudo\\s+)?';
const svc = (name) => `${name}(\\.service)?`;

test('Befehle Linux-Server', async (t) => {
  await checkAnswers(t, readAnswers(__dirname, 'befehle.txt'), [
    { key: 'ssh-anmelden', expect: /^ssh\s+pi@192\.168\.100\.133$/, hint: 'ssh benutzer@ip' },
    { key: 'status-nodered', expect: new RegExp(`^${SUDO}systemctl\\s+status\\s+${svc('nodered')}$`) },
    { key: 'neustart-grafana', expect: new RegExp(`^${SUDO}systemctl\\s+restart\\s+${svc('grafana-server')}$`), hint: 'Dienstname: grafana-server' },
    { key: 'autostart-mariadb', expect: new RegExp(`^${SUDO}systemctl\\s+enable\\s+(--now\\s+)?${svc('mariadb')}$`), hint: 'nicht start, sondern …' },
    {
      key: 'log-live-nodered',
      // journalctl mit -u nodered UND -f/--follow, in beliebiger Reihenfolge
      expect: new RegExp(`^${SUDO}journalctl(?=.*\\s-u\\s*${svc('nodered')}(\\s|$))(?=.*\\s(-f|--follow)(\\s|$)).+$`),
      hint: 'journalctl, -u für den Dienst, -f für live',
    },
    { key: 'paketlisten', expect: new RegExp(`^${SUDO}apt(-get)?\\s+update$`) },
    { key: 'installieren-libatomic', expect: new RegExp(`^${SUDO}apt(-get)?\\s+install\\s+(-y\\s+)?libatomic1(\\s+-y)?$`) },
    { key: 'ausfuehrbar', expect: /^chmod\s+(\+x|u\+x|a\+x|0?755)\s+(\.\/)?planeten-erdbeben-setup-linux-arm64$/ },
    { key: 'nur-besitzer-env', expect: /^chmod\s+0?600\s+(\.\/)?\.env$/, hint: 'rw- für den Besitzer, nichts für die anderen' },
    { key: 'speicherplatz', expect: /^df\s+-h(\s+\S+)?$/, hint: 'df mit -h für „human readable“' },
    { key: 'lauschende-ports', expect: new RegExp(`^${SUDO}ss\\s+-(?=[a-z]*l)(?=[a-z]*t)[a-z]+$`), hint: 'ss mit -l (lauschend) und -t (TCP), z. B. -ltnp' },
    {
      key: 'datenbank-sichern',
      // -u planeten, -p (nach dem Passwort fragen lassen), die Datenbank, Umleitung in backup.sql
      expect: /^(mysqldump|mariadb-dump)(?=.*\s-u\s*planeten(\s|$))(?=.*\s(-p|--password)(\s|$))(?=.*\splaneten_erdbeben(\s|>|$)).*>\s*backup\.sql$/,
      hint: 'mysqldump -u … -p datenbank > datei',
    },
    { key: 'cron-zeile', expect: /^30\s+0?2\s+\*\s+\*\s+\*\s+\/home\/pi\/backup\.sh$/, hint: 'Minute Stunde Tag Monat Wochentag Befehl' },
  ]);
});
