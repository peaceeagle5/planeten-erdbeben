// Planeten & Erdbeben setup wizard.
// Starts a small web server on this computer and opens the setup page in the browser.
// From there it configures an existing database, Node-RED and Grafana over the network.
//
//   node setup-wizard/server.js            (development)
//   ./planeten-erdbeben-setup               (built single-file program, see build.js)
const http = require('node:http');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { readAsset } = require('../shared/assets');
const { testDb, setupDb, countEvents } = require('./lib/db');
const { NodeRed, testNodeRed, scanNodeRed } = require('./lib/nodered');
const { testGrafana, setupGrafana } = require('./lib/grafana');

const TOKEN = crypto.randomBytes(16).toString('hex');
const PREFERRED_PORT = Number(process.env.SETUP_PORT) || 8790;

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

/** Database address + login as seen from the Node-RED/Grafana servers. */
function dbForServers(db) {
  return {
    host: (db.serverHost || '').trim() || db.host,
    port: Number(db.serverPort) || Number(db.port) || 3306,
    user: db.user, password: db.password, database: db.database,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Install: runs the selected steps and streams progress as NDJSON lines
// ---------------------------------------------------------------------------
async function install(cfg, send) {
  const step = (id, status, message) => send({ type: 'step', id, status, message });
  const log = (message) => send({ type: 'log', message });
  const result = {};
  const owner = String(cfg.owner || '').trim();
  if (!owner) throw new Error('Bitte oben deinen Namen eintragen.');

  if (cfg.steps.db) {
    step('db', 'running', 'Datenbank wird eingerichtet ...');
    await setupDb(cfg.db, log);
    step('db', 'ok', 'Datenbank und Tabellen sind bereit.');
  }

  let before = null;
  if (cfg.steps.nodered) {
    step('nodered', 'running', 'Node-RED wird eingerichtet ...');
    const nr = new NodeRed(cfg.nodered);
    const info = await nr.info();
    log(`Node-RED ${info.version} gefunden.`);
    const check = await testNodeRed({ ...cfg.nodered, owner, allowOverwrite: cfg.nodered.allowOverwrite });
    if (!check.ok) throw new Error(check.message);
    if (!info.functionExternalModules) throw new Error('Node-RED erlaubt keine externen Module (functionExternalModules: false in settings.js).');
    if (!info.hasMysql) await nr.installMysqlNode(log);
    try { before = await countEvents(cfg.db); } catch { /* tables may be missing if db step skipped */ }
    await nr.deployTab(dbForServers(cfg.db), info.tabId, owner);
    log(info.tabExists ? 'Tab "Planeten & Erdbeben" aktualisiert und deployt.' : 'Tab "Planeten & Erdbeben" angelegt und deployt.');
    step('nodered', 'ok', 'Node-RED-Flow ist deployt.');
  }

  if (cfg.steps.grafana) {
    step('grafana', 'running', 'Grafana wird eingerichtet ...');
    result.dashboardUrl = await setupGrafana(cfg.grafana, dbForServers(cfg.db), owner, log);
    step('grafana', 'ok', 'Grafana-Datenquelle und Dashboard sind angelegt.');
  }

  if (cfg.steps.nodered) {
    // End-to-end check: Node-RED fetches quakes after 5 s and computes positions after 15 s.
    step('verify', 'running', 'Warte auf die ersten Daten von Node-RED (bis zu 2 Minuten) ...');
    const start = Date.now();
    let last = null;
    while (Date.now() - start < 120000) {
      await sleep(5000);
      try { last = await countEvents(cfg.db); } catch (err) { log(`Zählen fehlgeschlagen: ${err.message}`); continue; }
      const newComputed = before ? last.computed > before.computed : last.computed > 0;
      const caughtUp = last.computed > 0 && last.pending === 0 && Date.now() - start > 30000;
      if (newComputed || caughtUp) {
        step('verify', 'ok', `Läuft! ${last.quakes} Erdbeben in der Datenbank, ${last.pending} warten noch auf die Berechnung.`);
        result.verified = true;
        break;
      }
    }
    if (!result.verified) {
      step('verify', 'warn', last && last.total > 0
        ? `Erdbeben kommen an (${last.total} Events), aber es wurden noch keine Positionen berechnet. ` +
          'Node-RED installiert beim ersten Mal das Modul astronomy-engine (braucht Internet). Im Node-RED-Editor das Debug-Fenster prüfen.'
        : 'Noch keine Daten. Hat der Node-RED-Server Internet (earthquake.usgs.gov)? Im Node-RED-Editor das Debug-Fenster prüfen.');
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

let server;
let port;

async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  // Only answer requests addressed to this local server (protects against DNS rebinding).
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) {
    return sendJson(res, 403, { error: 'forbidden' });
  }

  if (req.method === 'GET' && url.pathname === '/') {
    if (url.searchParams.get('t') !== TOKEN) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Bitte die Adresse verwenden, die das Setup-Programm im Fenster anzeigt.');
    }
    const html = readAsset('setup-wizard/ui.html').replace('__SETUP_TOKEN__', TOKEN);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(html);
  }

  if (req.method !== 'POST' || req.headers['x-setup-token'] !== TOKEN) return sendJson(res, 403, { error: 'forbidden' });
  const body = await readJson(req);

  switch (url.pathname) {
    case '/api/test': {
      const tests = { db: testDb, nodered: testNodeRed, grafana: testGrafana };
      const fn = tests[body.section];
      if (!fn) return sendJson(res, 400, { error: 'unknown section' });
      return sendJson(res, 200, await fn({ ...body.config, owner: body.owner }));
    }
    case '/api/scan': {
      try {
        return sendJson(res, 200, { ok: true, found: await scanNodeRed(body.host, body.from, body.to) });
      } catch (err) {
        return sendJson(res, 200, { ok: false, message: err.message });
      }
    }
    case '/api/install': {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
      const send = (obj) => res.write(JSON.stringify(obj) + '\n');
      try {
        const result = await install(body, send);
        send({ type: 'done', ...result });
      } catch (err) {
        send({ type: 'error', message: err.message });
      }
      return res.end();
    }
    case '/api/backfill': {
      try {
        await new NodeRed(body.nodered).injectBackfill(body.year, body.minmag);
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 200, { ok: false, message: err.message });
      }
    }
    case '/api/status': {
      try {
        return sendJson(res, 200, { ok: true, ...(await countEvents(body.db)) });
      } catch (err) {
        return sendJson(res, 200, { ok: false, message: err.message });
      }
    }
    case '/api/quit': {
      sendJson(res, 200, { ok: true });
      console.log('Setup beendet.');
      setTimeout(() => process.exit(0), 200);
      return undefined;
    }
    default:
      return sendJson(res, 404, { error: 'not found' });
  }
}

function openBrowser(link) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', link]]
    : process.platform === 'darwin' ? ['open', [link]]
      : ['xdg-open', [link]];
  execFile(cmd, args, { windowsVerbatimArguments: true }, () => { /* user can open the link manually */ });
}

function listen(p) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(p, '127.0.0.1', () => { server.off('error', reject); resolve(server.address().port); });
  });
}

async function main() {
  server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
      else res.end();
    });
  });
  try { port = await listen(PREFERRED_PORT); } catch { port = await listen(0); }
  const link = `http://127.0.0.1:${port}/?t=${TOKEN}`;
  console.log('');
  console.log('  Planeten & Erdbeben – Setup');
  console.log('  ===========================');
  console.log(`  Die Setup-Seite öffnet sich im Browser. Falls nicht, diese Adresse öffnen:`);
  console.log(`  ${link}`);
  console.log('');
  console.log('  Dieses Fenster offen lassen, solange das Setup läuft.');
  console.log('');
  if (!process.env.SETUP_NO_BROWSER) openBrowser(link);
}

main().catch((err) => { console.error(err); process.exit(1); });
