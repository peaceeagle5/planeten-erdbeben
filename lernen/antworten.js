// Prüft Antworten aus einfachen Textdateien – für Übungen ohne JavaScript.
//
// Format der Textdatei (z. B. antworten.txt):
//   # Kommentarzeilen beginnen mit #
//   port-grafana: 3000
//   fall-1: b
// Leer gelassene Antworten gelten als "noch offen" und werden übersprungen.
//
// Mit LOESUNG=1 wird statt "antworten.txt" die Datei "loesung-antworten.txt" gelesen.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

/** Liest "schlüssel: wert"-Zeilen. Ergebnis: Map schlüssel → wert (getrimmt). */
function readAnswers(dir, fileName) {
  const file = path.join(dir, process.env.LOESUNG ? `loesung-${fileName}` : fileName);
  const answers = new Map();
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    answers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return answers;
}

/** Vereinheitlicht eine Antwort: klein, ohne doppelte Leerzeichen, ohne Punkt am Ende. */
const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');

/**
 * Ein Unter-Test pro Frage.
 * items: [{ key, expect, hint }]
 *   expect: Text (oder Array erlaubter Texte) → genauer Vergleich nach normalize()
 *           RegExp → muss passen (für Befehle mit mehreren richtigen Schreibweisen)
 */
async function checkAnswers(t, answers, items) {
  for (const { key, expect, hint } of items) {
    await t.test(key, (tt) => {
      const given = answers.get(key.toLowerCase());
      if (given === undefined) assert.fail(`Die Zeile "${key}:" fehlt in der Antwortdatei.`);
      if (given === '') { tt.skip('noch offen'); return; }
      const ok = expect instanceof RegExp
        ? expect.test(given.trim())
        : [].concat(expect).map(normalize).includes(normalize(given));
      assert.ok(ok, `Deine Antwort "${given}" stimmt noch nicht.${hint ? ` Tipp: ${hint}` : ''}`);
    });
  }
}

module.exports = { readAnswers, checkAnswers };
