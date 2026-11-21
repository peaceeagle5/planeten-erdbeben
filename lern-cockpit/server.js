// Lern-Cockpit: a small local web page around the exercises in lernen/.
//
//   npm run lernen:ui
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
const { spawn, execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO = path.join(__dirname, '..');
const SOURCE = path.join(REPO, 'lernen');
const WORK = path.join(REPO, 'meine-uebungen');
const STATE_DIR = path.join(WORK, '.cockpit');
const PROGRESS_FILE = path.join(STATE_DIR, 'fortschritt.json');
const BACKUP_DIR = path.join(STATE_DIR, 'sicherungen');
const REPORTER = path.join(__dirname, 'reporter.mjs');
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
// Working folder
// ---------------------------------------------------------------------------

/** readme | test | solution | edit. Only "edit" files belong to the pupil. */
function fileKind(name) {
  if (name === 'README.md') return 'readme';
  if (name.endsWith('.test.js')) return 'test';
  if (name.startsWith('loesung')) return 'solution';
  return 'edit';
}

/**
 * Copies one file. In texts, "node --test lernen/01-…" becomes "node --test 01-…", because the
 * cockpit terminal starts in meine-uebungen/. Commands meant for the project folder
 * (docker build -f lernen/…, git add lernen/…) stay as they are.
 */
function copyFile(src, dst) {
  if (/\.(md|txt|js|sql)$/.test(src) && !src.endsWith('.test.js')) {
    const text = fs.readFileSync(src, 'utf8').replace(/\bnode (--test )?lernen\//g, 'node $1');
    fs.writeFileSync(dst, text);
  } else {
    fs.copyFileSync(src, dst);
  }
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
    const src = path.join(SOURCE, entry.name);
    const dst = path.join(WORK, entry.name);
    if (entry.isFile()) {
      copyFile(src, dst);
      continue;
    }
    if (!entry.isDirectory()) continue;
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src, { withFileTypes: true })) {
      if (!f.isFile()) continue;
      const target = path.join(dst, f.name);
      const own = fileKind(f.name) === 'edit';
      if (own && fs.existsSync(target)) continue;
      copyFile(path.join(src, f.name), target);
      if (own) copied.push(`${entry.name}/${f.name}`);
    }
  }
  fs.writeFileSync(path.join(WORK, 'package.json'), `${JSON.stringify(WORK_PACKAGE, null, 2)}\n`);
  return { created, copied };
}

const inside = (root, p) => {
  const r = path.relative(root, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};
const toRel = (p) => path.relative(WORK, p).split(path.sep).join('/');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
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

const plain = (s) => s.replace(/[`*]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();

/** Unit list with title, learning path and files, read from lernen/README.md and the folders. */
function readUnits() {
  const meta = new Map();
  const row = /^\|\s*(\d+)\s*\|\s*\[([^\]]+)\]\(([^)/]+)\/README\.md\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/;
  for (const line of fs.readFileSync(path.join(WORK, 'README.md'), 'utf8').split('\n')) {
    const m = line.match(row);
    if (m) {
      meta.set(m[3], {
        title: plain(m[2]), topic: plain(m[4]), exercises: plain(m[5]),
        fiae: m[6].trim(), fisi: m[7].trim(), time: m[8].trim(),
      });
    }
  }
  const progress = loadProgress();
  return fs.readdirSync(WORK, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name))
    .map((d) => d.name)
    .sort()
    .map((dir) => {
      const names = fs.readdirSync(path.join(WORK, dir)).filter((n) => fs.statSync(path.join(WORK, dir, n)).isFile());
      const rank = (n) => (EDIT_ORDER.includes(n) ? EDIT_ORDER.indexOf(n) : EDIT_ORDER.length);
      const files = names
        .map((name) => ({ name, kind: fileKind(name) }))
        .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
      let m = meta.get(dir);
      if (!m) {
        const heading = (fs.readFileSync(path.join(WORK, dir, 'README.md'), 'utf8').match(/^#\s+(.*)$/m) || [])[1] || dir;
        m = { title: plain(heading.replace(/^\d+\s*[–-]\s*/, '')), topic: '', exercises: '', fiae: '●', fisi: '', time: '' };
      }
      return { dir, num: dir.slice(0, 2), ...m, files, progress: summary(progress, dir) };
    });
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
    for (const t of result.tests) {
      if (!t.leaf) continue;
      s[t.status] += 1;
      s.total += 1;
    }
    if (!s.at || result.at > s.at) s.at = result.at;
  }
  return s;
}

/** Stores the reporter's lines. A test file's old results are replaced as a whole. */
function mergeResults(lines) {
  const byFile = new Map();
  for (const line of lines) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (!ev.file || !inside(WORK, ev.file)) continue; // e.g. "npm test" in the project folder
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
  const progress = loadProgress();
  return Object.entries(progress.files)
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

const prompt = () => `meine-uebungen${cwd === WORK ? '' : `/${toRel(cwd)}`}`;

/** Splits a command line into words; quotes group words and are removed. */
function words(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const HELP = `Befehle in diesem Terminal
  node --test 01-js-werkzeuge/   Tests einer Einheit ausführen
  node --test                    alle Tests im aktuellen Ordner und darunter
  npm run lernen                 alle Tests (Lernweg FIAE)
  npm run lernen:fisi            nur die Praxis-Übungen (Lernweg FISI)
  LOESUNG=1 node --test ...      Tests gegen die Musterlösung laufen lassen
  node datei.js                  ein Programm starten
  git ...                        Git-Befehle (z. B. für Einheit 13)
  docker ...                     Docker-Befehle (z. B. für Einheit 12)

  cd ordner   cd ..   ls   pwd   cat datei   clear

Tasten: ↑/↓ frühere Befehle · Tab ergänzt Datei- und Ordnernamen · Strg+C bricht ab · Strg+L leert
`;

/** Built-in commands, so they behave the same on Windows, macOS and Linux. */
const BUILTINS = {
  help: () => HELP,
  hilfe: () => HELP,
  pwd: () => `${cwd}\n`,
  cd: (args) => {
    const arg = args.find((a) => !a.startsWith('-'));
    const target = !arg || arg === '~' ? WORK : path.resolve(cwd, arg);
    if (!inside(WORK, target)) return 'cd: Das Terminal bleibt im Ordner meine-uebungen.\n';
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return `cd: Ordner nicht gefunden: ${arg}\n`;
    cwd = target;
    return '';
  },
  ls: (args) => {
    const all = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const arg = args.find((a) => !a.startsWith('-'));
    const dir = path.resolve(cwd, arg || '.');
    if (!inside(WORK, dir) || !fs.existsSync(dir)) return `ls: nicht gefunden: ${arg}\n`;
    if (!fs.statSync(dir).isDirectory()) return `${path.basename(dir)}\n`;
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => all || !e.name.startsWith('.'))
      .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name))
      .map((e) => (e.isDirectory() ? `\x1b[34m${e.name}/\x1b[0m` : e.name))
      .join('\n') + '\n';
  },
  cat: (args) => {
    const arg = args.find((a) => !a.startsWith('-'));
    if (!arg) return 'cat: Welche Datei? Beispiel: cat uebung.js\n';
    const file = path.resolve(cwd, arg);
    if (!inside(WORK, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return `cat: Datei nicht gefunden: ${arg}\n`;
    const text = fs.readFileSync(file, 'utf8');
    return text.endsWith('\n') ? text : `${text}\n`;
  },
};
BUILTINS.dir = BUILTINS.ls;
BUILTINS.type = BUILTINS.cat;

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
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {});
  } else {
    try { process.kill(-pid, 'SIGINT'); } catch { /* already gone */ }
    const c = child;
    setTimeout(() => { if (child === c) { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } } }, 2000);
  }
}

/** Runs one terminal line and streams its output. The last chunk is "\0" + JSON with the result. */
async function runLine(line, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  const finish = (exit, updated = []) => {
    res.end(`\u0000${JSON.stringify({ exit, prompt: prompt(), updated })}`);
  };

  // Leading NAME=value words set environment variables (works on Windows too).
  const envMatch = line.match(/^\s*((?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)\s+)*)/);
  const extraEnv = {};
  for (const w of words(envMatch[1])) {
    const eq = w.indexOf('=');
    extraEnv[w.slice(0, eq)] = w.slice(eq + 1);
  }
  const command = line.slice(envMatch[0].length).trim();
  const [name, ...args] = words(command);
  if (!name) return finish(0);

  const builtin = BUILTINS[name.toLowerCase()];
  if (builtin) {
    res.write(builtin(args));
    return finish(0);
  }
  if (!PROGRAMS.has(name)) {
    res.write(`${name}: Dieser Befehl ist im Lern-Cockpit nicht verfügbar. "hilfe" zeigt, was geht.\n`
      + 'Für alles andere: das normale Terminal (PowerShell, Terminal) im Ordner meine-uebungen öffnen.\n');
    return finish(127);
  }
  if (/[;&|<>`]|\$\(/.test(command)) {
    res.write('Bitte nur einen Befehl pro Zeile – ; & | < > sind hier nicht erlaubt.\n');
    return finish(2);
  }
  if (child) {
    res.write('Es läuft schon ein Befehl. Strg+C bricht ihn ab.\n');
    return finish(1);
  }

  runCounter += 1;
  const reportFile = path.join(STATE_DIR, `lauf-${process.pid}-${runCounter}.jsonl`);
  const proc = spawn(command, {
    cwd, shell: true, env: childEnv(extraEnv, reportFile), stdio: ['ignore', 'pipe', 'pipe'], detached: !IS_WIN,
  });
  child = proc;
  proc.stdout.on('data', (d) => res.write(d));
  proc.stderr.on('data', (d) => res.write(d));
  res.on('close', () => { if (!res.writableEnded && child === proc) stopChild(); });

  const exit = await new Promise((resolve) => {
    proc.on('error', (err) => { res.write(`${err.message}\n`); resolve(1); });
    proc.on('close', (code, signal) => resolve(signal ? 130 : code));
  });
  child = null;

  let updated = [];
  try {
    updated = mergeResults(fs.readFileSync(reportFile, 'utf8').split('\n').filter(Boolean));
    fs.unlinkSync(reportFile);
  } catch { /* no tests in this command */ }
  return finish(exit, updated);
}

/** Tab completion: names in the folder of the last word, relative to the terminal folder. */
function complete(word) {
  const w = String(word || '');
  const slash = Math.max(w.lastIndexOf('/'), w.lastIndexOf('\\'));
  const dirPart = slash >= 0 ? w.slice(0, slash + 1) : '';
  const dir = path.resolve(cwd, dirPart || '.');
  if (!inside(WORK, dir) || !fs.existsSync(dir)) return [];
  const start = w.slice(slash + 1);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name.startsWith(start) && !e.name.startsWith('.'))
    .map((e) => dirPart + e.name + (e.isDirectory() ? '/' : ''))
    .sort();
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
      if (size > 2_000_000) { reject(new HttpError(413, 'Zu groß.')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'Ungültiges JSON.')); }
    });
    req.on('error', reject);
  });
}

/** Read-only view of other project files that the explanations link to (never secrets). */
function repoFile(relPath) {
  const p = path.resolve(REPO, String(relPath || ''));
  const parts = path.relative(REPO, p).split(path.sep);
  const secret = parts.some((s) => s.startsWith('.env') || s === '.git' || s === 'node_modules' || /cred/i.test(s));
  if (!inside(REPO, p) || secret) throw new HttpError(403, 'Diese Datei wird hier nicht angezeigt.');
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new HttpError(404, `Datei nicht gefunden: ${relPath}`);
  if (fs.statSync(p).size > 500_000) throw new HttpError(413, 'Die Datei ist zu groß für die Anzeige.');
  return fs.readFileSync(p, 'utf8');
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(path.join(__dirname, 'ui.html')));
  }
  if (!url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
  if (req.headers['x-token'] !== TOKEN) return sendJson(res, 403, { error: 'Bitte die Adresse aus dem Startfenster öffnen.' });

  const q = (k) => url.searchParams.get(k);
  switch (`${req.method} ${url.pathname}`) {
    case 'GET /api/state':
      return sendJson(res, 200, { units: readUnits(), prompt: prompt(), workDir: WORK, running: Boolean(child) });
    case 'GET /api/file': {
      const p = workPath(q('path'));
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new HttpError(404, 'Datei nicht gefunden.');
      return sendJson(res, 200, { content: fs.readFileSync(p, 'utf8') });
    }
    case 'GET /api/repofile':
      return sendJson(res, 200, { content: repoFile(q('path')) });
    case 'GET /api/results':
      return sendJson(res, 200, { results: unitResults(String(q('unit'))) });
    case 'POST /api/file': {
      const body = await readBody(req);
      const { p } = ownFile(body.path);
      if (typeof body.content !== 'string') throw new HttpError(400, 'Kein Inhalt.');
      fs.writeFileSync(p, body.content);
      return sendJson(res, 200, { ok: true });
    }
    case 'POST /api/reset': {
      const body = await readBody(req);
      const { p, unit, name } = ownFile(body.path);
      const template = path.join(SOURCE, unit, name);
      if (!fs.existsSync(template)) throw new HttpError(404, 'Zu dieser Datei gibt es keine Vorlage.');
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backup = path.join(BACKUP_DIR, `${unit}-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
      if (fs.existsSync(p)) fs.copyFileSync(p, backup);
      copyFile(template, p);
      return sendJson(res, 200, { ok: true, backup: toRel(backup), content: fs.readFileSync(p, 'utf8') });
    }
    case 'POST /api/run': {
      const body = await readBody(req);
      return runLine(String(body.line || ''), res);
    }
    case 'POST /api/stop':
      stopChild();
      return sendJson(res, 200, { ok: true });
    case 'POST /api/complete': {
      const body = await readBody(req);
      return sendJson(res, 200, { matches: complete(body.word) });
    }
    default:
      return sendJson(res, 404, { error: 'not found' });
  }
}

function openBrowser(link) {
  const [cmd, args] = IS_WIN ? ['cmd', ['/c', 'start', '""', link]]
    : process.platform === 'darwin' ? ['open', [link]]
      : ['xdg-open', [link]];
  execFile(cmd, args, { windowsVerbatimArguments: true }, () => { /* user can open the link manually */ });
}

function listen(server, p) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(p, '127.0.0.1', () => { server.off('error', reject); resolve(server.address().port); });
  });
}

async function main() {
  const { created, copied } = syncWorkDir();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) sendJson(res, err.status || 500, { error: err.message });
      else res.end();
    });
  });
  let port;
  try { port = await listen(server, PREFERRED_PORT); } catch { port = await listen(server, 0); }
  const link = `http://127.0.0.1:${port}/?t=${TOKEN}`;
  console.log('');
  console.log('  Planeten & Erdbeben – Lern-Cockpit');
  console.log('  ==================================');
  if (created) console.log(`  Dein Arbeitsordner wurde angelegt: ${WORK}`);
  else if (copied.length) console.log(`  Neue Übungsdateien kopiert: ${copied.join(', ')}`);
  console.log('  Die Seite öffnet sich im Browser. Falls nicht, diese Adresse öffnen:');
  console.log(`  ${link}`);
  console.log('');
  console.log('  Dieses Fenster offen lassen, solange du übst. Beenden: Strg+C');
  console.log('');
  if (!process.env.LERN_NO_BROWSER) openBrowser(link);
}

main().catch((err) => { console.error(err); process.exit(1); });
