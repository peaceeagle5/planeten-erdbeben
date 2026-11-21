// Builds single-file programs (Node.js "single executable applications") for the setup wizard
// and the Lern-Cockpit: bundle the server with esbuild, then put it with its assets into a copy of
// the official Node.js binary for each platform.
//
// The Node.js binaries are downloaded once into setup-wizard/.cache (git-ignored).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, 'setup-wizard', '.cache');
const NODE_VERSION = process.version; // embed the same Node version that runs the build
// Fixed paths instead of PATH lookups (same on macOS and the Ubuntu CI machines).
const UNZIP = '/usr/bin/unzip';
const TAR = '/usr/bin/tar';
const CODESIGN = '/usr/bin/codesign';

const PLATFORMS = {
  'win-x64': { archive: `node-${NODE_VERSION}-win-x64.zip`, binary: 'node.exe', suffix: '-windows-x64.exe' },
  'linux-x64': { archive: `node-${NODE_VERSION}-linux-x64.tar.xz`, binary: 'bin/node', suffix: '-linux-x64' },
  'linux-arm64': { archive: `node-${NODE_VERSION}-linux-arm64.tar.xz`, binary: 'bin/node', suffix: '-linux-arm64' },
  'darwin-arm64': { archive: `node-${NODE_VERSION}-darwin-arm64.tar.gz`, binary: 'bin/node', suffix: '-macos-arm64' },
};
const DEFAULT_TARGETS = ['win-x64', 'linux-x64', 'linux-arm64'];

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} (HTTP ${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/** Returns the path of the Node.js binary for a target, downloading it if needed. */
async function nodeBinary(target) {
  const t = PLATFORMS[target];
  const dir = path.join(CACHE, t.archive.replace(/\.(zip|tar\.xz|tar\.gz)$/, ''));
  const bin = path.join(dir, t.binary);
  if (fs.existsSync(bin)) return bin;
  fs.mkdirSync(CACHE, { recursive: true });
  const archive = path.join(CACHE, t.archive);
  if (!fs.existsSync(archive)) {
    console.log(`  downloading ${t.archive} ...`);
    await download(`https://nodejs.org/dist/${NODE_VERSION}/${t.archive}`, archive);
  }
  console.log(`  extracting ${t.archive} ...`);
  if (archive.endsWith('.zip')) execFileSync(UNZIP, ['-q', '-o', archive, '-d', CACHE]);
  else execFileSync(TAR, ['-xf', archive, '-C', CACHE]);
  if (!fs.existsSync(bin)) throw new Error(`${bin} not found after extracting`);
  return bin;
}

/** File name in dist/ for a program and target, e.g. planeten-lern-cockpit-windows-x64.exe */
const outputName = (name, target) => name + PLATFORMS[target].suffix;

/**
 * @param {object} o
 * @param {string} o.name      program name, e.g. "planeten-lern-cockpit"
 * @param {string} o.entry     server script, relative to the project
 * @param {string[]} o.assets  files embedded as SEA assets, relative to the project (read with readAsset)
 * @param {string[]} [o.targets] platforms from the command line; default Windows x64, Linux x64, Linux arm64
 */
async function buildSea({ name, entry, assets, targets }) {
  const list = targets?.length ? targets : DEFAULT_TARGETS;
  const unknown = list.filter((t) => !PLATFORMS[t]);
  if (unknown.length) throw new Error(`Unknown target "${unknown[0]}". Known: ${Object.keys(PLATFORMS).join(', ')}`);
  fs.mkdirSync(DIST, { recursive: true });

  // 1. bundle the server and everything it requires into one CommonJS file
  const bundle = path.join(DIST, `${name}.cjs`);
  await esbuild.build({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: bundle,
    legalComments: 'none', logLevel: 'warning',
  });
  console.log(`bundled ${path.relative(ROOT, bundle)} (${(fs.statSync(bundle).size / 1024).toFixed(0)} KB)`);

  // 2. the official Node.js binaries (downloaded in parallel), then one executable per target
  const binaries = await Promise.all(list.map(nodeBinary));
  list.forEach((target, k) => {
    console.log(`${target}:`);
    const out = path.join(DIST, outputName(name, target));
    const config = {
      main: bundle,
      output: out,
      executable: binaries[k],
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false, // code cache is platform specific; we cross-build
      assets: Object.fromEntries(assets.map((f) => [f, path.join(ROOT, f)])),
    };
    const configFile = path.join(DIST, `sea-config-${name}-${target}.json`);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    execFileSync(process.execPath, ['--build-sea', configFile], { stdio: 'inherit' });
    fs.rmSync(configFile);
    if (target.startsWith('darwin') && process.platform === 'darwin') {
      execFileSync(CODESIGN, ['--sign', '-', '--force', out]); // ad-hoc signature, required on macOS
    }
    // A program everyone may run and nobody but the owner may change, like any file in /usr/bin.
    if (!target.startsWith('win')) fs.chmodSync(out, 0o755); // NOSONAR
    console.log(`  -> dist/${outputName(name, target)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(0)} MB)`);
  });
}

/** Runs buildSea from a build script and exits with an error message on failure. */
function runBuild(options) {
  buildSea({ ...options, targets: process.argv.slice(2) }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { buildSea, runBuild, outputName };
