const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

const PATTERNS = ['# Kommentar', '', 'node_modules/', '.env', 'node-red/flow_cred.json', 'dist/', '*.zip'];

test('1. isIgnored', () => {
  assert.equal(m.isIgnored('node_modules/mysql2/index.js', PATTERNS), true);
  assert.equal(m.isIgnored('lernen/node_modules/x.js', PATTERNS), true, 'Ordner-Muster gilt überall');
  assert.equal(m.isIgnored('.env', PATTERNS), true);
  assert.equal(m.isIgnored('setup/.env', PATTERNS), true, 'Dateiname gilt in jedem Ordner');
  assert.equal(m.isIgnored('.env.beispiel', PATTERNS), false, '.env.beispiel ist nicht .env');
  assert.equal(m.isIgnored('node-red/flow_cred.json', PATTERNS), true);
  assert.equal(m.isIgnored('node-red/flow.json', PATTERNS), false);
  assert.equal(m.isIgnored('PlanetenErdbebenIoT.zip', PATTERNS), true);
  assert.equal(m.isIgnored('dist/a.exe', PATTERNS), true);
  assert.equal(m.isIgnored('src/planets.js', PATTERNS), false);
  assert.equal(m.isIgnored('distanz.js', PATTERNS), false, 'dist/ ist ein Ordner, nicht ein Wortanfang');
});

test('2. parseStatus', () => {
  const out = m.parseStatus(' M app.js\nM  src/a.js\nA  neu.js\nMM beides.js\n?? notizen.txt\n');
  assert.deepEqual(out, {
    staged: ['src/a.js', 'neu.js', 'beides.js'],
    modified: ['app.js', 'beides.js'],
    untracked: ['notizen.txt'],
  });
});

test('3. suspiciousFiles', () => {
  assert.deepEqual(
    m.suspiciousFiles(['src/planets.js', '.env', 'node-red/flow_cred.json', 'keys/server.KEY', 'docs/Password-Liste.txt', 'README.md']),
    ['.env', 'node-red/flow_cred.json', 'keys/server.KEY', 'docs/Password-Liste.txt']);
});

test('4. resolveConflict', () => {
  const text = [
    'function computeSky(date, place, options = {}) {',
    '<<<<<<< HEAD',
    '  const orb = options.orb ?? 8;',
    '=======',
    '  const orb = options.orb ?? 6;',
    '>>>>>>> neue-idee',
    '  return orb;',
    '}',
  ].join('\n');
  assert.equal(m.resolveConflict(text, 'ours'),
    'function computeSky(date, place, options = {}) {\n  const orb = options.orb ?? 8;\n  return orb;\n}');
  assert.equal(m.resolveConflict(text, 'theirs'),
    'function computeSky(date, place, options = {}) {\n  const orb = options.orb ?? 6;\n  return orb;\n}');
});

test('5. goodCommitMessage', () => {
  assert.equal(m.goodCommitMessage('Mondphase in Prozent statt Grad anzeigen'), true);
  assert.equal(m.goodCommitMessage('fix'), false);
  assert.equal(m.goodCommitMessage('Update.'), false);
  assert.equal(m.goodCommitMessage('kurz'), false, 'zu kurz');
  assert.equal(m.goodCommitMessage('x'.repeat(73)), false, 'erste Zeile zu lang');
  assert.equal(m.goodCommitMessage('Einheit 01 gelöst\n\nLange Erklärung in weiteren Zeilen ist erlaubt.'), true);
});

test('6. Die echte .gitignore schützt die Geheimnisse', () => {
  const patterns = fs.readFileSync(path.join(__dirname, '..', '..', '.gitignore'), 'utf8').split('\n');
  for (const secret of ['.env', 'node-red/flow_cred.json', 'node_modules/esbuild/package.json']) {
    assert.equal(m.isIgnored(secret, patterns), true, `${secret} würde committet werden!`);
  }
  assert.equal(m.isIgnored('src/planets.js', patterns), false, 'Der Code selbst muss ins Repository');
});
