// Shared helper for tools/lernpaket.js and tools/projektpaket.js: copies the listed files into a
// staging folder, applies text edits, checks that no real password is inside, and zips it.
// Needs the `zip` command (macOS/Linux).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

/** Passwords from any .env* file, except the learning-environment ones compose.yaml publishes on purpose. */
function realSecrets() {
  const publicOnPurpose = fs.readFileSync(path.join(ROOT, 'compose.yaml'), 'utf8');
  return fs.readdirSync(ROOT).filter((f) => /^\.env(\..+)?$/.test(f))
    .flatMap((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n'))
    .filter((l) => /PASSWORD=/.test(l)).map((l) => l.slice(l.indexOf('=') + 1).trim())
    .filter((v) => v.length >= 8 && !publicOnPurpose.includes(v));
}

/** Replaces exactly what is expected; fails loudly if a text to edit is not found (file changed). */
function replaceOrFail(text, from, to, file) {
  const hit = from instanceof RegExp ? from.test(text) : text.includes(from);
  if (!hit) throw new Error(`${file}: text to edit not found: ${String(from).slice(0, 60)}`);
  return text.replace(from, to);
}

/** Text edits both packages share: drop parts that only make sense in the author's own copy. */
const COMMON_EDITS = {
  'README.md': [
    // author's own machine, not useful for others
    [/## Local development setup on this Mac\n[\s\S]*?(?=\n## )/, ''],
    // the packing tools are not part of the packages
    [/ `node tools\/lernpaket\.js` packs project \+ learning units \+\nDocker environment into `dist\/PlanetenErdbeben-Lernpaket\.zip` \(no executables, no real passwords\)\./, ''],
  ],
};

/**
 * @param {object} o
 * @param {string} o.name      top folder inside the zip
 * @param {string} o.out       zip path, relative to the project
 * @param {string[]} o.include files/folders, relative to the project
 * @param {string} o.gitignore content of the .gitignore inside the package
 * @param {Record<string, Array<[string|RegExp, string|Function]>>} [o.edits] text edits per file
 * @param {Record<string, (json:object)=>void>} [o.jsonEdits] edits for JSON files
 */
function buildPackage({ name, out, include, gitignore, edits = {}, jsonEdits = {} }) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'paket-'));
  const dest = path.join(stage, name);
  fs.mkdirSync(dest);
  for (const rel of include) {
    fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
    fs.cpSync(path.join(ROOT, rel), path.join(dest, rel), {
      recursive: true,
      filter: (src) => !/(\.DS_Store|node_modules)$/.test(src),
    });
  }
  fs.writeFileSync(path.join(dest, '.gitignore'), gitignore);

  const filesToEdit = new Set([...Object.keys(COMMON_EDITS), ...Object.keys(edits)]);
  for (const file of filesToEdit) {
    const all = [...(COMMON_EDITS[file] || []), ...(edits[file] || [])];
    const p = path.join(dest, file);
    let text = fs.readFileSync(p, 'utf8');
    for (const [from, to] of all) text = replaceOrFail(text, from, to, file);
    fs.writeFileSync(p, text);
  }
  for (const [file, fn] of Object.entries(jsonEdits)) {
    const p = path.join(dest, file);
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    fn(json);
    fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  }

  // No real password may be inside, not even in the executables (searched as bytes).
  const secrets = realSecrets().map((s) => Buffer.from(s));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const file of walk(dest)) {
    const data = fs.readFileSync(file);
    if (secrets.some((s) => data.includes(s))) {
      fs.rmSync(stage, { recursive: true, force: true });
      throw new Error(`A real password from .env* was found in ${path.relative(dest, file)}: aborting`);
    }
  }

  const outPath = path.join(ROOT, out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.rmSync(outPath, { force: true });
  execFileSync('zip', ['-9', '-r', '-X', '-q', outPath, name], { cwd: stage });
  fs.rmSync(stage, { recursive: true, force: true });
  const size = fs.statSync(outPath).size;
  console.log(`Wrote ${out} (${size > 1e6 ? `${(size / 1e6).toFixed(0)} MB` : `${(size / 1024).toFixed(0)} KB`}, ` +
    `${secrets.length} real passwords checked: none inside)`);
}

/** Sources both packages contain. */
const SOURCES = [
  'ERSTE-SCHRITTE.md', 'LABOR-PROXY.md', 'README.md', 'package.json', 'package-lock.json', 'compose.yaml', '.dockerignore', 'app.js',
  'src', 'shared', 'db', 'grafana', 'docker',
  'node-red/flow-builder.js', 'node-red/flow-import.json', 'node-red/functions',
  'setup-wizard/server.js', 'setup-wizard/ui.html', 'setup-wizard/build.js', 'setup-wizard/lib',
  'tools/korrelation.js',
];

const GITIGNORE = 'node_modules/\n.env\nnode-red/flow_cred.json\ndist/\nsetup-wizard/.cache/\n*.zip\nmeine-uebungen/\nsmoke-uebungen/\n';

module.exports = { buildPackage, SOURCES, GITIGNORE };
