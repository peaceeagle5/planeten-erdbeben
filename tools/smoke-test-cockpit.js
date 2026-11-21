// Smoke test for a built Lern-Cockpit executable: does it find the project, serve the page and run
// real test commands in its terminal? Used by .github/workflows/test.yml on Linux and Windows, works locally too:
//
//   node tools/smoke-test-cockpit.js dist/planeten-lern-cockpit-linux-x64
//
// Needs Node.js on the PATH (like the pupils) and the project's node_modules (npm ci).
// Works in its own folder "smoke-uebungen" next to lernen/ and deletes it afterwards.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const exe = process.argv[2];
if (!exe) {
  console.error('Usage: node tools/smoke-test-cockpit.js <executable>');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const WORK_NAME = 'smoke-uebungen';
const WORK = path.join(ROOT, WORK_NAME);
let failures = 0;
const check = (ok, text) => {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures += 1;
};

// Started from another folder on purpose: the program has to find the project from its own location.
const child = spawn(path.resolve(exe), [], {
  cwd: path.dirname(path.resolve(exe)),
  env: { ...process.env, LERN_NO_BROWSER: '1', LERN_PORT: '8796', LERN_ARBEITSORDNER: WORK_NAME },
});
let output = '';
child.stdout.on('data', (d) => { output += d; });
child.stderr.on('data', (d) => { output += d; });

async function waitForLink() {
  for (let i = 0; i < 300; i += 1) {
    const m = /http:\/\/127\.0\.0\.1:(\d+)\/\?t=([a-f0-9]+)/.exec(output);
    if (m) return { base: `http://127.0.0.1:${m[1]}`, token: m[2], link: m[0] };
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no start message after 30 s. Output:\n${output}`);
}

async function main() {
  const { base, token, link } = await waitForLink();
  check(true, `started, listening on ${base}`);
  check(fs.existsSync(path.join(WORK, '01-js-werkzeuge', 'uebung.js')), `working folder ${WORK_NAME}/ created`);

  const page = await fetch(link);
  check(page.status === 200 && (await page.text()).includes('<title>Lern-Cockpit'), 'page loads');
  const script = await fetch(`${base}/ui/app.mjs`);
  check(script.status === 200 && /javascript/.test(script.headers.get('content-type')), 'page script is served');
  check((await fetch(`${base}/api/state`)).status === 403, 'API without token is refused (403)');

  const headers = { 'X-Token': token, 'Content-Type': 'application/json' };
  const state = await (await fetch(`${base}/api/state`, { headers })).json();
  check(state.units.length >= 15, `${state.units.length} units listed`);
  check(Boolean(state.node), `Node.js found: ${state.node?.version}`);

  const run = async (line) => {
    const text = await (await fetch(`${base}/api/run`, { method: 'POST', headers, body: JSON.stringify({ line }) })).text();
    const end = text.indexOf('\u0000');
    return { output: text.slice(0, end), meta: JSON.parse(text.slice(end + 1)) };
  };

  const ls = await run('ls 01-js-werkzeuge');
  check(ls.output.includes('uebung.js'), 'built-in ls works');
  const cd = await run('cd 05-planeten');
  check(cd.meta.prompt === `${WORK_NAME}/05-planeten`, `cd changes the folder (${cd.meta.prompt})`);
  // The same command the Prüfen button types, against the sample solution (works on Windows too).
  const tests = await run('LOESUNG=1 node --test "*.test.js"');
  const unit = tests.meta.updated.find((u) => u.dir === '05-planeten');
  check(tests.meta.exit === 0 && unit?.pass === unit?.total && unit?.total > 0,
    `node --test runs, progress recorded (${unit?.pass}/${unit?.total})`);
  const npm = await run('npm run lernen:fisi');
  check(npm.meta.updated.length > 0, `npm run lernen:fisi runs (${npm.meta.updated.length} units reported)`);
  const refused = await run('rm -rf x');
  check(refused.meta.exit === 127, 'other programs are refused');
}

main()
  .catch((err) => check(false, err.message))
  .finally(() => {
    child.kill();
    fs.rmSync(WORK, { recursive: true, force: true });
    console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
    process.exit(failures ? 1 : 0);
  });
