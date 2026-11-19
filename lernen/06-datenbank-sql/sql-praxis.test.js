// Vergleicht deine Abfragen aus uebung.sql mit loesung.sql auf der echten Datenbank.
// Nur SELECT ist erlaubt; der Test verändert nichts.
// Zugangsdaten: siehe lernen/verbindung.js (Standard: Docker-Umgebung, Benutzer "lernen").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { dbConfig } = require('../verbindung');

/** { 1: 'SELECT …', 2: '' , … } */
function readTasks(file) {
  const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
  // split mit Klammer im Muster liefert: [Vorspann, '1', Text zu 1, '2', Text zu 2, …]
  const parts = text.split(/^-- Aufgabe (\d+):/m);
  const tasks = {};
  for (let i = 1; i < parts.length; i += 2) {
    const sqlLines = parts[i + 1].split('\n').slice(1) // erste Zeile = Rest der Überschrift
      .filter((l) => !l.trim().startsWith('--'));
    tasks[parts[i]] = sqlLines.join('\n').trim().replace(/;\s*$/, '');
  }
  return tasks;
}

const mine = readTasks(process.env.LOESUNG ? 'loesung.sql' : 'uebung.sql');
const solution = readTasks('loesung.sql');

test('SQL-Aufgaben', async (t) => {
  let mysql;
  try { mysql = require('mysql2/promise'); } catch { t.skip('mysql2 fehlt: npm install'); return; }
  let conn;
  try {
    conn = await mysql.createConnection({ ...dbConfig(), rowsAsArray: true });
  } catch (err) {
    t.skip(`Datenbank nicht erreichbar (${err.code}). Läuft "docker compose up -d"? Sonst Zugang in .env eintragen (lernen/verbindung.js).`);
    return;
  }

  try {
    for (const num of Object.keys(solution)) {
      await t.test(`Aufgabe ${num}`, async (tt) => {
        const sql = mine[num];
        if (!sql) { tt.skip('noch nicht bearbeitet'); return; }
        if (!/^\s*SELECT\b/i.test(sql) || /;\s*\S/.test(sql)) {
          assert.fail('Bitte genau eine SELECT-Abfrage pro Aufgabe');
        }
        let got;
        try { [got] = await conn.query(sql); } catch (err) { assert.fail(`SQL-Fehler: ${err.message}`); }
        const [expected] = await conn.query(solution[num]);
        const norm = (rows) => rows.map((r) => r.map((v) => (v === null ? null : String(Number.isNaN(Number(v)) ? v : Number(v)))));
        assert.deepEqual(norm(got), norm(expected),
          `Ergebnis weicht ab.\nDeins (erste 3 Zeilen):  ${JSON.stringify(norm(got).slice(0, 3))}\nErwartet (erste 3 Zeilen): ${JSON.stringify(norm(expected).slice(0, 3))}`);
      });
    }
  } finally {
    await conn.end();
  }
});
