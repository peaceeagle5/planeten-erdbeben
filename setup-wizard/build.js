// Builds the setup wizard as single-file programs (Node.js "single executable applications").
//
//   node setup-wizard/build.js              -> dist/ for Windows x64, Linux x64, Linux arm64
//   node setup-wizard/build.js darwin-arm64 -> only the given target(s)
//
// The official Node.js binary for each platform is downloaded once into setup-wizard/.cache.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const { ASSET_FILES } = require('../shared/assets');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(__dirname, '.cache');
const NODE_VERSION = process.version; // embed the same Node version that runs the build
const NAME = 'planeten-erdbeben-setup';

const TARGETS = {
  'win-x64': { archive: `node-${NODE_VERSION}-win-x64.zip`, binary: 'node.exe', out: `${NAME}-windows-x64.exe` },
  'linux-x64': { archive: `node-${NODE_VERSION}-linux-x64.tar.xz`, binary: 'bin/node', out: `${NAME}-linux-x64` },
  'linux-arm64': { archive: `node-${NODE_VERSION}-linux-arm64.tar.xz`, binary: 'bin/node', out: `${NAME}-linux-arm64` },
  'darwin-arm64': { archive: `node-${NODE_VERSION}-darwin-arm64.tar.gz`, binary: 'bin/node', out: `${NAME}-macos-arm64` },
};

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} (HTTP ${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/** Returns the path of the Node.js binary for a target, downloading it if needed. */
async function nodeBinary(target) {
  const t = TARGETS[target];
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
  if (archive.endsWith('.zip')) execFileSync('unzip', ['-q', '-o', archive, '-d', CACHE]);
  else execFileSync('tar', ['-xf', archive, '-C', CACHE]);
  if (!fs.existsSync(bin)) throw new Error(`${bin} not found after extracting`);
  return bin;
}

async function main() {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['win-x64', 'linux-x64', 'linux-arm64'];
  for (const t of targets) if (!TARGETS[t]) throw new Error(`Unknown target "${t}". Known: ${Object.keys(TARGETS).join(', ')}`);
  fs.mkdirSync(DIST, { recursive: true });

  // 1. bundle server + libs + mysql2 into one CommonJS file
  const bundle = path.join(DIST, `${NAME}.cjs`);
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'server.js')],
    bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: bundle,
    legalComments: 'none', logLevel: 'warning',
  });
  console.log(`bundled ${path.relative(ROOT, bundle)} (${(fs.statSync(bundle).size / 1024).toFixed(0)} KB)`);

  // 2. one executable per target
  for (const target of targets) {
    console.log(`${target}:`);
    const out = path.join(DIST, TARGETS[target].out);
    const config = {
      main: bundle,
      output: out,
      executable: await nodeBinary(target),
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false, // code cache is platform specific; we cross-build
      assets: Object.fromEntries(ASSET_FILES.map((f) => [f, path.join(ROOT, f)])),
    };
    const configFile = path.join(DIST, `sea-config-${target}.json`);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    execFileSync(process.execPath, ['--build-sea', configFile], { stdio: 'inherit' });
    fs.rmSync(configFile);
    if (target.startsWith('darwin') && process.platform === 'darwin') {
      execFileSync('codesign', ['--sign', '-', '--force', out]); // ad-hoc signature, required on macOS
    }
    if (!target.startsWith('win')) fs.chmodSync(out, 0o755);
    console.log(`  -> dist/${TARGETS[target].out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(0)} MB)`);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
