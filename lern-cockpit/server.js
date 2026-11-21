// Lern-Cockpit: a small local web page around the exercises in lernen/.
//
//   npm run lernen:ui                       (in the project folder)
//   planeten-lern-cockpit(.exe)             (built single-file program, see build.js)
//
// Pupils work in meine-uebungen/, a git-ignored copy of lernen/ inside the project folder.
// So "git pull" never overwrites their answers and "git push" never publishes them.
// The folder sits at the same depth as lernen/, so the tests' relative paths
// (../antworten, ../../src/planets, ../../compose.yaml ...) keep working unchanged.
//
// The page has a built-in terminal: commands like "node --test", "npm run lernen" or "git status"
// run for real in meine-uebungen/. A small reporter (reporter.mjs, added via NODE_OPTIONS)
// records the test results, so the page can show progress per unit.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const { spawn, execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { readAsset, isSea } = require('../shared/assets');

/** Files the page needs; inside the .exe they are embedded (see build.js). */
const UI_ASSETS = {
  '/': ['lern-cockpit/ui.html', 'text/html'],
  '/ui/app.mjs': ['lern-cockpit/ui/app.mjs', 'text/javascript'],
  '/ui/markdown.mjs': ['lern-cockpit/ui/markdown.mjs', 'text/javascript'],
  '/ui/terminal.mjs': ['lern-cockpit/ui/terminal.mjs', 'text/javascript'],
};
const REPORTER_ASSET = 'lern-cockpit/reporter.mjs';

const TOKEN = crypto.randomBytes(16).toString('hex');
const PREFERRED_PORT = Number(process.env.LERN_PORT) || 8791;
const IS_WIN = process.platform === 'win32';

/** Programs the terminal may start. Everything else is a built-in command (see BUILTINS). */
const PROGRAMS = new Set(['node', 'npm', 'git', 'docker']);
/** Pupil files that should show up first in the editor tabs. */
const EDIT_ORDER = ['uebung.js', 'antworten.txt', 'befehle.txt', 'quiz.txt', 'uebung.sql', 'Dockerfile'];

const WORK_PACKAGE = {
  name: 'meine-uebungen',
  private: true,
  description: 'Deine Lösungen zu den Lerneinheiten. Wird vom Lern-Cockpit angelegt und ist nicht im Git-Repository.',
  scripts: {
    lernen: 'node --test "**/*.test.js"',
    'lernen:fisi': 'node --test "**/*-praxis.test.js"',
  },
};

// ---------------------------------------------------------------------------
// Project folder
// ---------------------------------------------------------------------------

/** The folder that contains lernen/README.md, searched upwards from each start folder. */
function findProject(starts) {
  for (const start of starts.filter(Boolean)) {
    let dir = path.resolve(start);
    for (;;) {
      if (fs.existsSync(path.join(dir, 'lernen', 'README.md'))) return dir;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

// The program itself may sit in the project folder (or below it, e.g. dist/), or be started from there.
const PROJECT = findProject([
  process.env.LERN_PROJEKT,
  isSea() ? path.dirname(process.execPath) : path.join(__dirname, '..'),
  process.cwd(),
]);
// LERN_ARBEITSORDNER: another folder name next to lernen/ (the smoke test uses it, so it never touches real work).
const WORK_NAME = /^[\w-]+$/.test(process.env.LERN_ARBEITSORDNER || '') ? process.env.LERN_ARBEITSORDNER : 'meine-uebungen';
const SOURCE = PROJECT && path.join(PROJECT, 'lernen');
const WORK = PROJECT && path.join(PROJECT, WORK_NAME);
const STATE_DIR = WORK && path.join(WORK, '.cockpit');
const PROGRESS_FILE = STATE_DIR && path.join(STATE_DIR, 'fortschritt.json');
const BACKUP_DIR = STATE_DIR && path.join(STATE_DIR, 'sicherungen');
const REPORTER = STATE_DIR && path.join(STATE_DIR, 'reporter.mjs');

// ---------------------------------------------------------------------------
// Working folder
// ---------------------------------------------------------------------------

/** readme | test | solution | edit. Only "edit" files belong to the pupil. */
function fileKind(name) {
  if (name === 'README.md') return 'readme';
  if (name.endsWith('.test.js')) return 'test';
  if (name.startsWith('loesung')) return 'solution';
  return 'edit';
}

const FOLDER_TEST_COMMAND = /\bnode --test lernen\/(\d\d-[\w-]+)\/(?=[\s`'")]|$)/gm;
const PROJECT_PATH_COMMAND = /\bnode (--test )?("?)lernen\//g;

/**
 * Copies one file. In texts, test commands are adapted to the cockpit terminal, which starts in
 * meine-uebungen/:  node --test "lernen/01-…/*.test.js"  →  node --test "01-…/*.test.js"
 * The old folder form (node --test lernen/01-…/) becomes the glob form, because Node 24 no longer
 * accepts a folder. Commands meant for the project folder (docker build -f lernen/…, git add lernen/…)
 * stay as they are.
 */
function copyFile(src, dst) {
  const isText = /\.(md|txt|js|sql)$/.test(src) || src.endsWith('Dockerfile');
  if (!isText || src.endsWith('.test.js')) {
    fs.copyFileSync(src, dst);
    return;
  }
  const text = fs.readFileSync(src, 'utf8')
    .replaceAll(FOLDER_TEST_COMMAND, 'node --test "$1/*.test.js"')
    .replaceAll(PROJECT_PATH_COMMAND, 'node $1$2');
  fs.writeFileSync(dst, text);
}

/** Copies one unit folder. Returns the pupil files that were new. */
function syncUnit(name) {
  const src = path.join(SOURCE, name);
  const dst = path.join(WORK, name);
  fs.mkdirSync(dst, { recursive: true });
  const copied = [];
  for (const f of fs.readdirSync(src, { withFileTypes: true })) {
    const target = path.join(dst, f.name);
    const own = fileKind(f.name) === 'edit';
    if (f.isFile() && !(own && fs.existsSync(target))) {
      copyFile(path.join(src, f.name), target);
      if (own) copied.push(`${name}/${f.name}`);
    }
  }
  return copied;
}

/**
 * Copies lernen/ into meine-uebungen/. Explanations, tests and solutions are refreshed every time
 * (they belong to the project); the pupil's own files are only copied when they do not exist yet.
 */
function syncWorkDir() {
  const created = !fs.existsSync(WORK);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const copied = [];
  for (const entry of fs.readdirSync(SOURCE, { withFileTypes: true })) {
    if (entry.isFile()) copyFile(path.join(SOURCE, entry.name), path.join(WORK, entry.name));
    else if (entry.isDirectory()) copied.push(...syncUnit(entry.name));
  }
  fs.writeFileSync(path.join(WORK, 'package.json'), `${JSON.stringify(WORK_PACKAGE, null, 2)}\n`);
  fs.writeFileSync(REPORTER, readAsset(REPORTER_ASSET));
  return { created, copied };
}

const inside = (root, p) => {
  const r = path.relative(root, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};
const toRel = (p) => path.relative(WORK, p).split(path.sep).join('/');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Resolves a path relative to meine-uebungen/ and refuses anything outside it. */
function workPath(relPath) {
  const p = path.resolve(WORK, String(relPath || ''));
  if (!inside(WORK, p)) throw new HttpError(400, 'Der Pfad liegt außerhalb von meine-uebungen.');
  return p;
}

/** Unit folder + file name of a pupil file, or an error if the file is not the pupil's. */
function ownFile(relPath) {
  const p = workPath(relPath);
  const parts = toRel(p).split('/');
  if (parts.length !== 2 || !/^\d\d-/.test(parts[0]) || fileKind(parts[1]) !== 'edit') {
    throw new HttpError(400, 'Diese Datei gehört zum Projekt und kann hier nicht geändert werden.');
  }
  return { p, unit: parts[0], name: parts[1] };
}

// ---------------------------------------------------------------------------
// Units and progress
// ---------------------------------------------------------------------------

const plain = (s) => s.replaceAll(/[`*]/g, '').replaceAll(/\[([^[\]]+)\]\([^()]*\)/g, '$1').trim();
const UNIT_LINK = /^\[([^[\]]+)\]\(([^)/]+)\/README\.md\)$/;

/** Reads the unit table in lernen/README.md: | # | [Title](dir/README.md) | topic | exercises | FIAE | FISI | time | */
function readUnitTable() {
  const meta = new Map();
  for (const line of fs.readFileSync(path.join(WORK, 'README.md'), 'utf8').split('\n')) {
    const cols = line.split('|').map((c) => c.trim());
    const m = cols.length >= 9 && /^\d+$/.test(cols[1]) ? UNIT_LINK.exec(cols[2]) : null;
    if (m) {
      meta.set(m[2], {
        title: plain(m[1]), topic: plain(cols[3]), exercises: plain(cols[4]),
        fiae: cols[5], fisi: cols[6], time: cols[7],
      });
    }
  }
  return meta;
}

/** For a unit missing in the table: title from the first heading of its README. */
function metaFromReadme(dir) {
  const first = fs.readFileSync(path.join(WORK, dir, 'README.md'), 'utf8').split('\n').find((l) => l.startsWith('# '));
  const heading = first ? first.slice(2).trim() : dir;
  const title = heading.replace(/^\d+ [–-] /, '');
  return { title: plain(title), topic: '', exercises: '', fiae: '●', fisi: '', time: '' };
}

function unitFiles(dir) {
  const rank = (n) => (EDIT_ORDER.includes(n) ? EDIT_ORDER.indexOf(n) : EDIT_ORDER.length);
  return fs.readdirSync(path.join(WORK, dir), { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => ({ name: e.name, kind: fileKind(e.name) }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

/** Unit list with title, learning path, files and progress. */
function readUnits() {
  const meta = readUnitTable();
  const progress = loadProgress();
  return fs.readdirSync(WORK, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b))
    .map((dir) => ({
      dir, num: dir.slice(0, 2), ...(meta.get(dir) || metaFromReadme(dir)),
      files: unitFiles(dir), progress: summary(progress, dir),
    }));
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { files: {} };
  }
}

/** Counts only "leaf" tests (tests without subtests), so a quiz with 12 sub-questions counts 12. */
function summary(progress, dir) {
  const s = { pass: 0, fail: 0, skip: 0, total: 0, at: null };
  for (const [file, result] of Object.entries(progress.files)) {
    if (!file.startsWith(`${dir}/`)) continue;
    for (const t of result.tests.filter((x) => x.leaf)) {
      s[t.status] += 1;
      s.total += 1;
    }
    if (!s.at || result.at > s.at) s.at = result.at;
  }
  return s;
}

function parseLines(lines) {
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch { /* incomplete line, e.g. after Strg+C */ }
  }
  return events;
}

/** Stores the reporter's lines. A test file's old results are replaced as a whole. */
function mergeResults(lines) {
  const byFile = new Map();
  for (const ev of parseLines(lines)) {
    if (!ev.file || !inside(WORK, ev.file)) continue; // e.g. "npm run lernen" in the project folder
    const rel = toRel(ev.file);
    if (!byFile.has(rel)) byFile.set(rel, []);
    byFile.get(rel).push(ev);
  }
  if (byFile.size === 0) return [];
  const progress = loadProgress();
  const at = new Date().toISOString();
  for (const [rel, events] of byFile) {
    // Subtests finish before their parent, so a parent directly follows a deeper test.
    const tests = events.map((ev, i) => ({
      name: ev.name, status: ev.status, message: ev.message, nesting: ev.nesting,
      leaf: !(i > 0 && events[i - 1].nesting > ev.nesting),
    }));
    progress.files[rel] = { at, tests };
  }
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 1));
  const units = [...new Set([...byFile.keys()].map((f) => f.split('/')[0]))].filter((d) => /^\d\d-/.test(d));
  return units.map((dir) => ({ dir, ...summary(progress, dir) }));
}

function unitResults(dir) {
  return Object.entries(loadProgress().files)
    .filter(([file]) => file.startsWith(`${dir}/`))
    .map(([file, r]) => ({ file: file.slice(dir.length + 1), at: r.at, tests: r.tests }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------

let cwd = WORK;
let child = null;
let runCounter = 0;

function prompt() {
  if (cwd === WORK) return WORK_NAME;
  return `${WORK_NAME}/${toRel(cwd)}`;
}

/** Splits a command line into words; quotes group words and are removed. */
function words(line) {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

const ENV_ASSIGNMENT = /^([A-Za-z_]\w*)=("[^"]*"|'[^']*'|\S*)\s+/;

/** "LOESUNG=1 node --test ..." → { env: { LOESUNG: '1' }, command: 'node --test ...' } (works on Windows too). */
function splitEnv(line) {
  const env = {};
  let rest = line.trim();
  let m = ENV_ASSIGNMENT.exec(rest);
  while (m) {
    env[m[1]] = m[2].replaceAll(/^["']|["']$/g, '');
    rest = rest.slice(m[0].length);
    m = ENV_ASSIGNMENT.exec(rest);
  }
  return { env, command: rest };
}

const HELP = `Befehle in diesem Terminal
  node --test "01-js-werkzeuge/*.test.js"   Tests einer Einheit ausführen
  node --test                               alle Tests im aktuellen Ordner und darunter
  npm run lernen                            alle Tests (Lernweg FIAE)
  npm run lernen:fisi                       nur die Praxis-Übungen (Lernweg FISI)
  LOESUNG=1 node --test ...                 Tests gegen die Musterlösung laufen lassen
  node datei.js                             ein Programm starten
  git ...                                   Git-Befehle (z. B. für Einheit 13)
  docker ...                                Docker-Befehle (z. B. für Einheit 12)

  cd ordner   cd ..   ls   pwd   cat datei   clear

Tasten: ↑/↓ frühere Befehle · Tab ergänzt Datei- und Ordnernamen · Strg+C bricht ab · Strg+L leert
`;

const firstPath = (args) => args.find((a) => !a.startsWith('-'));

function cd(args) {
  const arg = firstPath(args);
  const target = !arg || arg === '~' ? WORK : path.resolve(cwd, arg);
  if (!inside(WORK, target)) return 'cd: Das Terminal bleibt im Ordner meine-uebungen.\n';
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return `cd: Ordner nicht gefunden: ${arg}\n`;
  cwd = target;
  return '';
}

function ls(args) {
  const all = args.some((a) => a.startsWith('-') && a.includes('a'));
  const arg = firstPath(args);
  const dir = path.resolve(cwd, arg || '.');
  if (!inside(WORK, dir) || !fs.existsSync(dir)) return `ls: nicht gefunden: ${arg}\n`;
  if (!fs.statSync(dir).isDirectory()) return `${path.basename(dir)}\n`;
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => all || !e.name.startsWith('.'))
    .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
  return entries.map((e) => (e.isDirectory() ? `\x1b[34m${e.name}/\x1b[0m` : e.name)).join('\n') + '\n';
}

function cat(args) {
  const arg = firstPath(args);
  if (!arg) return 'cat: Welche Datei? Beispiel: cat uebung.js\n';
  const file = path.resolve(cwd, arg);
  if (!inside(WORK, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return `cat: Datei nicht gefunden: ${arg}\n`;
  const text = fs.readFileSync(file, 'utf8');
  return text.endsWith('\n') ? text : `${text}\n`;
}

/** Built-in commands, so they behave the same on Windows, macOS and Linux. */
const BUILTINS = {
  help: () => HELP,
  hilfe: () => HELP,
  pwd: () => `${cwd}\n`,
  cd, ls, dir: ls, cat, type: cat,
};

function childEnv(extra, reportFile) {
  const fwd = (p) => p.split(path.sep).join('/'); // NODE_OPTIONS treats "\" as an escape character
  const reporters = [
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    `--test-reporter="${pathToFileURL(REPORTER).href}"`, `--test-reporter-destination="${fwd(reportFile)}"`,
  ].join(' ');
  return {
    ...process.env,
    ...extra,
    FORCE_COLOR: '1',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} ${reporters}`.trim(),
    GIT_TERMINAL_PROMPT: '0',
    GIT_EDITOR: 'node -e ""', // "git commit" without -m would wait for an editor forever
    npm_config_update_notifier: 'false',
    npm_config_fund: 'false',
  };
}

function stopChild() {
  if (!child) return;
  const { pid } = child;
  if (IS_WIN) {
    const taskkill = path.join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32', 'taskkill.exe');
    execFile(taskkill, ['/pid', String(pid), '/T', '/F'], () => { /* already gone */ });
    return;
  }
  const killGroup = (signal) => {
    try {
      process.kill(-pid, signal);
    } catch { /* already gone */ }
  };
  killGroup('SIGINT');
  const c = child;
  setTimeout(() => { if (child === c) killGroup('SIGKILL'); }, 2000);
}

/** Why a command line may not run, or null. */
function refusal(name, command) {
  if (!PROGRAMS.has(name)) {
    return `${name}: Dieser Befehl ist im Lern-Cockpit nicht verfügbar. "hilfe" zeigt, was geht.\n`
      + 'Für alles andere: das normale Terminal (PowerShell, Terminal) im Ordner meine-uebungen öffnen.\n';
  }
  if (/[;&|<>`]|\$\(/.test(command)) return 'Bitte nur einen Befehl pro Zeile – ; & | < > sind hier nicht erlaubt.\n';
  if (child) return 'Es läuft schon ein Befehl. Strg+C bricht ihn ab.\n';
  return null;
}

/** Runs node/npm/git/docker and streams the output. Resolves with the exit code. */
function runProgram(command, env, reportFile, res) {
  // The pupil's own node/npm/git from PATH are meant here: the terminal teaches the real tools.
  const proc = spawn(command, { // NOSONAR
    cwd, shell: true, env: childEnv(env, reportFile), stdio: ['ignore', 'pipe', 'pipe'], detached: !IS_WIN,
  });
  child = proc;
  proc.stdout.on('data', (d) => res.write(d));
  proc.stderr.on('data', (d) => res.write(d));
  res.on('close', () => { if (!res.writableEnded && child === proc) stopChild(); });
  return new Promise((resolve) => {
    proc.on('error', (err) => {
      res.write(`${err.message}\n`);
      resolve(1);
    });
    proc.on('close', (code, signal) => {
      child = null;
      resolve(signal ? 130 : code);
    });
  });
}

function collectResults(reportFile) {
  try {
    const lines = fs.readFileSync(reportFile, 'utf8').split('\n').filter(Boolean);
    fs.unlinkSync(reportFile);
    return mergeResults(lines);
  } catch {
    return []; // no tests in this command
  }
}

/** Runs one terminal line and streams its output. The last chunk is "\0" + JSON with the result. */
async function runLine(line, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  const finish = (exit, updated = []) => res.end(`\u0000${JSON.stringify({ exit, prompt: prompt(), updated })}`);

  const { env, command } = splitEnv(line);
  const [name, ...args] = words(command);
  if (!name) return finish(0);
  const builtin = BUILTINS[name.toLowerCase()];
  if (builtin) {
    res.write(builtin(args));
    return finish(0);
  }
  const refused = refusal(name, command);
  if (refused) {
    res.write(refused);
    return finish(PROGRAMS.has(name) ? 2 : 127);
  }
  runCounter += 1;
  const reportFile = path.join(STATE_DIR, `lauf-${process.pid}-${runCounter}.jsonl`);
  const exit = await runProgram(command, env, reportFile, res);
  return finish(exit, collectResults(reportFile));
}

/** Tab completion: names in the folder of the last word, relative to the terminal folder. */
function complete(word) {
  const w = String(word || '');
  const slash = Math.max(w.lastIndexOf('/'), w.lastIndexOf('\\'));
  const dirPart = w.slice(0, slash + 1);
  const dir = path.resolve(cwd, dirPart || '.');
  if (!inside(WORK, dir) || !fs.existsSync(dir)) return [];
  const start = w.slice(slash + 1);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name.startsWith(start) && !e.name.startsWith('.'))
    .map((e) => dirPart + e.name + (e.isDirectory() ? '/' : ''))
    .sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Node.js check: the terminal needs node and npm on the computer
// ---------------------------------------------------------------------------

let nodeInfo = null;

function checkNode() {
  return new Promise((resolve) => {
    execFile('node', ['--version'], { shell: IS_WIN, timeout: 10_000 }, (err, stdout) => { // NOSONAR: node from PATH on purpose
      const version = String(stdout || '').trim();
      nodeInfo = err || !version ? null : { version, major: Number.parseInt(version.slice(1), 10) };
      resolve(nodeInfo);
    });
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2_000_000) {
        reject(new HttpError(413, 'Zu groß.'));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError(400, 'Ungültiges JSON.'));
      }
    });
    req.on('error', reject);
  });
}

/** Read-only view of other project files that the explanations link to (never secrets). */
function projectFile(relPath) {
  const p = path.resolve(PROJECT, String(relPath || ''));
  const parts = path.relative(PROJECT, p).split(path.sep);
  const secret = parts.some((s) => s.startsWith('.env') || s === '.git' || s === 'node_modules' || /cred/i.test(s));
  if (!inside(PROJECT, p) || secret) throw new HttpError(403, 'Diese Datei wird hier nicht angezeigt.');
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new HttpError(404, `Datei nicht gefunden: ${relPath}`);
  if (fs.statSync(p).size > 500_000) throw new HttpError(413, 'Die Datei ist zu groß für die Anzeige.');
  return fs.readFileSync(p, 'utf8');
}

function readWorkFile(relPath) {
  const p = workPath(relPath);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new HttpError(404, 'Datei nicht gefunden.');
  return fs.readFileSync(p, 'utf8');
}

async function saveFile(req) {
  const body = await readBody(req);
  const { p } = ownFile(body.path);
  if (typeof body.content !== 'string') throw new HttpError(400, 'Kein Inhalt.');
  fs.writeFileSync(p, body.content);
  return { ok: true };
}

/** Puts the template back; the pupil's version is kept in .cockpit/sicherungen. */
async function resetFile(req) {
  const body = await readBody(req);
  const { p, unit, name } = ownFile(body.path);
  const template = path.join(SOURCE, unit, name);
  if (!fs.existsSync(template)) throw new HttpError(404, 'Zu dieser Datei gibt es keine Vorlage.');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const backup = path.join(BACKUP_DIR, `${unit}-${name}-${stamp}`);
  if (fs.existsSync(p)) fs.copyFileSync(p, backup);
  copyFile(template, p);
  return { ok: true, backup: toRel(backup), content: fs.readFileSync(p, 'utf8') };
}

const ROUTES = {
  'GET /api/state': () => ({ units: readUnits(), prompt: prompt(), workDir: WORK, running: Boolean(child), node: nodeInfo }),
  'GET /api/file': ({ query }) => ({ content: readWorkFile(query.get('path')) }),
  'GET /api/repofile': ({ query }) => ({ content: projectFile(query.get('path')) }),
  'GET /api/results': ({ query }) => ({ results: unitResults(String(query.get('unit'))) }),
  'POST /api/file': ({ req }) => saveFile(req),
  'POST /api/reset': ({ req }) => resetFile(req),
  'POST /api/stop': () => {
    stopChild();
    return { ok: true };
  },
  'POST /api/complete': async ({ req }) => ({ matches: complete((await readBody(req)).word) }),
};

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const asset = req.method === 'GET' && UI_ASSETS[url.pathname];
  if (asset) {
    res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(readAsset(asset[0]));
    return;
  }
  if (!url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  if (req.headers['x-token'] !== TOKEN) {
    sendJson(res, 403, { error: 'Bitte die Adresse aus dem Startfenster öffnen.' });
    return;
  }
  const key = `${req.method} ${url.pathname}`;
  if (key === 'POST /api/run') {
    await runLine(String((await readBody(req)).line || ''), res);
    return;
  }
  const route = ROUTES[key];
  if (!route) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  sendJson(res, 200, await route({ req, query: url.searchParams }));
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function openBrowser(link) {
  let cmd = 'xdg-open';
  let args = [link];
  if (IS_WIN) {
    cmd = 'cmd';
    args = ['/c', 'start', '""', link];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
  }
  execFile(cmd, args, { windowsVerbatimArguments: true }, () => { /* user can open the link manually */ });
}

function listen(server, p) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(p, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

/** Keeps a double-clicked console window open, so the message can be read. */
function waitForEnter() {
  if (!process.stdin.isTTY) return Promise.resolve();
  console.log('  Enter drücken zum Beenden.');
  const rl = readline.createInterface({ input: process.stdin });
  return new Promise((resolve) => rl.once('line', () => {
    rl.close();
    resolve();
  }));
}

async function projectMissing() {
  console.log('');
  console.log('  Lern-Cockpit: Der Projektordner wurde nicht gefunden.');
  console.log('');
  console.log('  Leg das Programm in den Projektordner "Planeten & Erdbeben"');
  console.log('  (dort, wo der Ordner "lernen" liegt) und starte es dort.');
  console.log('  Oder gib den Ordner an:  LERN_PROJEKT=/pfad/zum/projekt');
  console.log('');
  await waitForEnter();
  process.exit(1);
}

function printStart(link, created, copied) {
  console.log('');
  console.log('  Planeten & Erdbeben – Lern-Cockpit');
  console.log('  ==================================');
  if (created) console.log(`  Dein Arbeitsordner wurde angelegt: ${WORK}`);
  else if (copied.length) console.log(`  Neue Übungsdateien kopiert: ${copied.join(', ')}`);
  if (!nodeInfo) console.log('  Achtung: Node.js wurde nicht gefunden. Die Tests brauchen Node.js (LTS von https://nodejs.org).');
  console.log('  Die Seite öffnet sich im Browser. Falls nicht, diese Adresse öffnen:');
  console.log(`  ${link}`);
  console.log('');
  console.log('  Dieses Fenster offen lassen, solange du übst. Beenden: Strg+C');
  console.log('');
}

async function main() {
  if (!PROJECT) {
    await projectMissing();
    return;
  }
  const { created, copied } = syncWorkDir();
  await checkNode();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) res.end();
      else sendJson(res, err.status || 500, { error: err.message });
    });
  });
  let port;
  try {
    port = await listen(server, PREFERRED_PORT);
  } catch {
    port = await listen(server, 0);
  }
  const link = `http://127.0.0.1:${port}/?t=${TOKEN}`;
  printStart(link, created, copied);
  if (!process.env.LERN_NO_BROWSER) openBrowser(link);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
