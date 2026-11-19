// Einheit 13 – Praxis: Prüft DEIN Git-Repository im Projektordner (ohne JavaScript).
// Die Schritte stehen in der README unter "Übung", Teil 2.
// Mit LOESUNG=1 übersprungen: Für das eigene Repository gibt es keine Musterlösung.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

test('Dein Git-Repository', { skip: process.env.LOESUNG ? 'eigenes Repository, keine Musterlösung' : false }, async (t) => {
  let isRepo = true;
  try { git('rev-parse', '--is-inside-work-tree'); } catch { isRepo = false; }

  if (!isRepo) { t.skip('noch offen: im Projektordner gibt es noch kein Git-Repository ("git init")'); return; }
  await t.test('1. Repository angelegt', () => assert.ok(isRepo));

  await t.test('2. mindestens zwei Commits', () => {
    let count = 0;
    try { count = Number(git('rev-list', '--count', 'HEAD')); } catch { /* noch kein Commit */ }
    assert.ok(count >= 2, `Bisher ${count} Commit(s). Erster Commit: alles übernehmen, zweiter: deine Übung.`);
  });

  await t.test('3. ein Übungs-Branch (uebung-…)', () => {
    const branches = git('branch', '--all', '--format=%(refname:short)').split('\n').filter((b) => /(^|\/)uebung-/.test(b));
    assert.ok(branches.length > 0, 'Leg einen Branch an, z. B. "git switch -c uebung-01"');
  });

  await t.test('4. .env ist nicht im Repository', () => {
    const tracked = git('ls-files').split('\n').filter((f) => /(^|\/)\.env$/.test(f));
    assert.deepEqual(tracked, [], `Diese Dateien mit Zugangsdaten sind im Repository: ${tracked.join(', ')}. Notfallplan in der README!`);
    if (fs.existsSync(path.join(ROOT, '.env'))) {
      let ignored = true;
      try { git('check-ignore', '-q', '.env'); } catch { ignored = false; }
      assert.ok(ignored, '.env steht nicht in der .gitignore');
    }
  });

  await t.test('5. aussagekräftige letzte Commit-Nachricht', () => {
    let msg = '';
    try { msg = git('log', '-1', '--format=%s'); } catch { /* kein Commit */ }
    const lazy = ['fix', 'update', 'changes', 'änderungen', 'wip', 'asdf', 'test'];
    assert.ok(msg.length >= 10 && msg.length <= 72 && !lazy.includes(msg.toLowerCase().replace(/\.$/, '')),
      `Letzte Nachricht: "${msg}". Besser: in einem Satz sagen, was sich ändert (10–72 Zeichen).`);
  });
});
