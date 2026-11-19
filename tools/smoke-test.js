// Smoke test for a built setup executable: does it start, serve the page and answer like expected?
// Used by .github/workflows/test.yml on Windows and Linux, works locally too:
//
//   node tools/smoke-test.js dist/planeten-erdbeben-setup-linux-x64
//
// Needs no database, Node-RED or Grafana: it checks the error messages for unreachable services.
const { spawn } = require('node:child_process');
const path = require('node:path');

const exe = process.argv[2];
if (!exe) { console.error('Usage: node tools/smoke-test.js <executable>'); process.exit(2); }

let failures = 0;
const check = (ok, text) => { console.log(`${ok ? '✓' : '✗'} ${text}`); if (!ok) failures++; };

const child = spawn(path.resolve(exe), [], { env: { ...process.env, SETUP_NO_BROWSER: '1', SETUP_PORT: '8790' } });
let output = '';
child.stdout.on('data', (d) => { output += d; });
child.stderr.on('data', (d) => { output += d; });
const exited = new Promise((resolve) => child.on('exit', resolve));
const timeout = (ms, what) => new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${what}`)), ms));

async function waitForLink() {
  for (let i = 0; i < 300; i++) {
    const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?t=([a-f0-9]+)/);
    if (m) return { base: `http://127.0.0.1:${m[1]}`, token: m[2], link: m[0] };
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no start message after 30 s. Output:\n${output}`);
}

async function main() {
  const { base, token, link } = await waitForLink();
  check(true, `started, listening on ${base}`);

  const page = await fetch(link);
  const html = await page.text();
  check(page.status === 200 && html.includes('<title>Planeten'), 'setup page loads');
  check(html.includes('preset-docker'), 'page has the "Lokale Docker-Umgebung" button');
  check((await fetch(`${base}/`)).status === 403, 'page without token is refused (403)');

  const post = async (p, body) => (await fetch(base + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Setup-Token': token }, body: JSON.stringify(body),
  })).json();

  // Port 59999 is free on CI machines: the services are unreachable on purpose.
  // (Not port 9: fetch refuses "bad ports" like 9 or 6000 before even trying.)
  const db = await post('/api/test', { section: 'db', owner: 'CI', config: { host: '127.0.0.1', port: 59999, user: 'x', password: 'x', database: 'planeten_erdbeben' } });
  check(db.ok === false && /Keine Datenbank unter 127\.0\.0\.1:59999/.test(db.message), `database error explained: ${db.message.slice(0, 60)}…`);
  const nr = await post('/api/test', { section: 'nodered', owner: 'CI', config: { url: 'http://127.0.0.1:59999' } });
  check(nr.ok === false && /läuft kein Node-RED/.test(nr.message), `Node-RED error explained: ${nr.message}`);
  const gf = await post('/api/test', { section: 'grafana', config: { url: 'http://127.0.0.1:59999', user: 'a', password: 'b' } });
  check(gf.ok === false && /läuft kein Grafana/.test(gf.message), `Grafana error explained: ${gf.message}`);

  await post('/api/quit', {});
  const code = await Promise.race([exited, timeout(5000, 'exit after "Setup beenden"')]);
  check(code === 0, `exits cleanly after "Setup beenden" (code ${code})`);
}

main()
  .catch((err) => { check(false, err.message); child.kill(); })
  .finally(() => {
    console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
    process.exit(failures ? 1 : 0);
  });
