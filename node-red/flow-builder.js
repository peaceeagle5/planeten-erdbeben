// Builds the "Planeten & Erdbeben" Node-RED flow tab.
// Used by the setup wizard (deploys it via the Node-RED admin API) and by
// `node node-red/flow-builder.js`, which writes flow-import.json for manual import.
const { readAsset } = require('../shared/assets');
const { normalizePrefix, tableNames } = require('../shared/tables');

const TAB = 'peb_tab';
const OWNER_PREFIX = 'Eingerichtet von: ';

/** Reads the owner name back from a tab description written by buildFlowTab. */
function ownerFromInfo(info) {
  const m = String(info || '').match(/^Eingerichtet von: (.+?)(?: \(\d{4}-\d{2}-\d{2}\))?$/m);
  return m ? m[1] : null;
}
const DB = 'peb_mysql';
const PLATES_URL = 'https://raw.githubusercontent.com/fraxen/tectonicplates/refs/heads/master/GeoJSON/PB2002_plates.json';


/** src/planets.js turned into plain function-node code (Astronomy comes from the node's libs). */
function planetsCode() {
  return readAsset('src/planets.js')
    .replace(/^const Astronomy = require\('astronomy-engine'\);\n/m, '')
    .replace(/^module\.exports = .*\n?/m, '');
}

/**
 * @param {{dbHost:string, dbPort:number|string, dbName:string, owner?:string, tablePrefix?:string}} opts
 *   dbHost/dbPort as seen from the Node-RED server (not from the wizard's PC).
 *   tablePrefix: e.g. "anna_" -> tables anna_events, ... (shared/tables.js). It is stored as the
 *   tab's environment variable TABLE_PREFIX, which every function node that names a table reads with
 *   env.get() (no table name is fixed anywhere else). So an imported flow-import.json only needs the
 *   prefix set on the tab.
 *   owner is written into the tab description, so the wizard can warn before overwriting
 *   someone else's Node-RED.
 * @returns {{id:string, label:string, info:string, nodes:object[], configs:object[]}}
 *   in the format of the Node-RED admin API "POST /flow".
 */
function buildFlowTab({ dbHost, dbPort, dbName, owner, tablePrefix }) {
  const prefix = normalizePrefix(tablePrefix);
  const T = tableNames(prefix);
  const fnCode = (file) => readAsset(`node-red/functions/${file}`);
  const base = (id, type, name, x, y, wires, extra = {}) => ({ id, type, z: TAB, name, x, y, wires, ...extra });
  const fnNode = (id, name, func, x, y, wires, libs = []) =>
    base(id, 'function', name, x, y, wires, { func, outputs: 1, timeout: 0, noerr: 0, initialize: '', finalize: '', libs });
  const httpNode = (id, name, url, x, y, wires) => base(id, 'http request', name, x, y, wires, {
    method: 'GET', ret: 'obj', paytoqs: 'ignore', url, tls: '', persist: false, proxy: '',
    insecureHTTPParser: false, authType: '', senderr: false, headers: [],
  });
  const mysqlNode = (id, name, x, y, wires = [[]]) => base(id, 'mysql', name, x, y, wires, { mydb: DB });
  const inject = (id, name, x, y, wires, o) => base(id, 'inject', name, x, y, wires, {
    props: [{ p: 'payload' }, { p: 'topic', vt: 'str' }],
    repeat: o.repeat || '', crontab: '', once: !!o.once, onceDelay: o.onceDelay || 0.1,
    topic: o.topic || '', payload: o.payload || '', payloadType: o.payloadType || 'date',
  });

  const nodes = [
    // 1. Ingest
    base('peb_c1', 'comment', '1. Erdbeben holen (live alle 5 min, oder Backfill per Klick)', 260, 40, []),
    inject('peb_live', 'alle 5 min', 130, 100, [['peb_usgs_live']], { repeat: '300', once: true, onceDelay: 5 }),
    httpNode('peb_usgs_live', 'USGS M4.5+ letzter Tag', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', 340, 100, [['peb_split']]),
    inject('peb_backfill', 'Backfill 2025 M5+', 140, 160, [['peb_backfill_url']],
      { payload: '{"start":"2025-01-01","end":"2026-01-01","minmag":5}', payloadType: 'json' }),
    fnNode('peb_backfill_url', 'USGS-Abfrage bauen', fnCode('backfill-url.js'), 350, 160, [['peb_usgs_query']]),
    httpNode('peb_usgs_query', 'USGS Katalog', '', 560, 160, [['peb_split']]),
    fnNode('peb_split', 'Beben + Kontrollen -> SQL', fnCode('split-usgs.js'), 780, 100, [['peb_db_insert']]),
    mysqlNode('peb_db_insert', 'INSERT Beben', 1000, 100),

    // 2. Enrich
    base('peb_c2', 'comment', '2. Planetenpositionen berechnen (jede Minute)', 250, 240, []),
    inject('peb_poll', 'jede Minute', 110, 300, [['peb_pending_sql']], { repeat: '60', once: true, onceDelay: 15 }),
    fnNode('peb_pending_sql', 'offene Events abfragen', fnCode('pending-sql.js'), 290, 300, [['peb_db_pending']]),
    mysqlNode('peb_db_pending', 'SELECT offene', 480, 300, [['peb_split_pending']]),
    fnNode('peb_split_pending', 'eine Nachricht pro Event', fnCode('split-pending.js'), 670, 300, [['peb_rate']]),
    base('peb_rate', 'delay', '20 / s', 850, 300, [['peb_sky']], {
      pauseType: 'rate', timeout: '5', timeoutUnits: 'seconds', rate: '20', nbRateUnits: '1',
      rateUnits: 'second', randomFirst: '1', randomLast: '5', randomUnits: 'seconds',
      drop: false, allowrate: false, outputs: 1,
    }),
    fnNode('peb_sky', 'Himmel berechnen -> SQL',
      `${planetsCode()}\n// ---------------------------------------------------------------\n${fnCode('compute-sky.js')}`,
      1030, 300, [['peb_db_write']], [{ var: 'Astronomy', module: 'astronomy-engine' }]),
    mysqlNode('peb_db_write', 'WRITE Positionen', 1240, 300),

    // 3. Tectonic plates
    base('peb_c3', 'comment', '3. Plattengrenzen holen (beim Start, dann jede Woche)', 260, 480, []),
    inject('peb_plates_timer', 'Start + jede Woche', 150, 540, [['peb_plates_http']], { repeat: '604800', once: true, onceDelay: 20 }),
    httpNode('peb_plates_http', 'PB2002 Platten (GitHub)', PLATES_URL, 370, 540, [['peb_plates_sql']]),
    fnNode('peb_plates_sql', 'Platten -> SQL', fnCode('plates-sql.js'), 580, 540, [['peb_db_plates']]),
    mysqlNode('peb_db_plates', 'WRITE Platten', 780, 540),

    // errors
    base('peb_catch', 'catch', 'Fehler', 120, 400, [['peb_debug']], { scope: null, uncaught: false }),
    base('peb_debug', 'debug', 'Fehler-Log', 300, 400, [], {
      active: true, tosidebar: true, console: true, tostatus: false, complete: 'true', targetType: 'full',
    }),
  ];

  const configs = [{
    id: DB, type: 'MySQLdatabase', z: TAB, name: dbName, host: String(dbHost), port: String(dbPort),
    db: dbName, tz: '+00:00', charset: 'UTF8',
  }];

  return {
    id: TAB,
    label: 'Planeten & Erdbeben',
    env: [{ name: 'TABLE_PREFIX', value: prefix, type: 'str' }],
    info: (owner ? `${OWNER_PREFIX}${owner} (${new Date().toISOString().slice(0, 10)})\n\n` : '') +
      `Tabellen: ${Object.values(T).join(', ')} (Präfix "${prefix}" in der Tab-Umgebungsvariable TABLE_PREFIX; ` +
      'plates und plate_points sind für alle gemeinsam).\n' +
      'Eigene Tabellen nach einem Import: Doppelklick auf den Tab → Umgebungsvariablen → TABLE_PREFIX, z. B. anna_.\n\n' +
      'Erstellt vom Planeten-Erdbeben-Setup.\n\n1. Holt Erdbeben von USGS (+ Kontroll-Events: gleicher Ort, zufällige Zeit) in die Datenbank.\n2. Berechnet für jedes Event die Positionen von Sonne, Mond und Planeten.\n3. Holt die Grenzen der tektonischen Platten (PB2002) in die Tabellen plates und plate_points.\n\nBackfill: Knopf links am Knoten "Backfill" klicken. Jahr per Doppelklick ändern.',
    nodes,
    configs,
  };
}

/** Same tab as a flat array, for Menu > Import in the Node-RED editor. */
function buildFlowImport(opts) {
  const { id, label, info, env, nodes, configs } = buildFlowTab(opts);
  return [{ id, type: 'tab', label, info, env, disabled: false }, ...nodes, ...configs];
}

module.exports = { buildFlowTab, buildFlowImport, ownerFromInfo, PLATES_URL, TAB_ID: TAB, BACKFILL_NODE_ID: 'peb_backfill', DB_CONFIG_ID: DB };

if (require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const out = path.join(__dirname, 'flow-import.json');
  const flow = buildFlowImport({ dbHost: '127.0.0.1', dbPort: 3306, dbName: 'planeten_erdbeben' });
  fs.writeFileSync(out, JSON.stringify(flow, null, 2) + '\n');
  console.log(`Wrote ${out} (${flow.length} nodes). Enter the DB login in the MySQL config node after import.`);
}
