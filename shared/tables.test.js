// Tests for personal tables (table prefix): node --test shared/
const test = require('node:test');
const assert = require('node:assert/strict');
const { prefixFromName, normalizePrefix, withPrefix, tableNames } = require('./tables');
const { readAsset } = require('./assets');
const { schemaStatements } = require('../setup-wizard/lib/db');
const { buildFlowTab, buildFlowImport } = require('../node-red/flow-builder');
const { buildDashboard } = require('../grafana/dashboard-builder');
const { computeSky } = require('../src/planets');

const PERSONAL = /\b(events|body_positions|aspects)\b/;

test('prefix from the name', () => {
  assert.equal(prefixFromName('Anna'), 'anna_');
  assert.equal(prefixFromName('Anna Müller'), 'anna_mueller_');
  assert.equal(prefixFromName('Pascal B.'), 'pascal_b_');
  assert.equal(prefixFromName('  José  Ñúñez '), 'jose_nunez_');
  assert.equal(prefixFromName('Groß'), 'gross_');
  assert.equal(prefixFromName('7b Gruppe 2'), 't7b_gruppe_2_');
  assert.equal(prefixFromName('???'), '');
  assert.equal(prefixFromName(''), '');
  assert.ok(prefixFromName('Maximilian-Alexander von Hohenzollern').length <= 24);
});

test('prefix typed by hand', () => {
  assert.equal(normalizePrefix(''), '');
  assert.equal(normalizePrefix(undefined), '');
  assert.equal(normalizePrefix('anna'), 'anna_');
  assert.equal(normalizePrefix(' Anna_ '), 'anna_');
  for (const bad of ['1anna', 'an na', 'anna;drop', 'a'.repeat(30), 'änna']) {
    assert.throws(() => normalizePrefix(bad), /Tabellen-Präfix/, bad);
  }
});

test('withPrefix renames only the personal tables', () => {
  const sql = 'SELECT * FROM events e JOIN body_positions bp ON bp.event_id = e.id ' +
    'JOIN aspects a ON a.event_id = e.id JOIN plates p ON 1 JOIN plate_points pp ON 1';
  const out = withPrefix(sql, 'anna_');
  assert.match(out, /FROM anna_events e JOIN anna_body_positions bp/);
  assert.match(out, /JOIN anna_aspects a/);
  assert.match(out, /JOIN plates p ON 1 JOIN plate_points pp/);
  assert.equal(withPrefix(out, 'anna_'), out, 'already prefixed names stay as they are');
  assert.equal(withPrefix(sql, ''), sql);
  assert.deepEqual(tableNames('anna_'), { events: 'anna_events', body_positions: 'anna_body_positions', aspects: 'anna_aspects' });
});

test('schema: personal tables, foreign keys and constraint names get the prefix', () => {
  const stmts = schemaStatements('anna_').join(';\n');
  for (const t of ['anna_events', 'anna_body_positions', 'anna_aspects']) assert.match(stmts, new RegExp(`CREATE TABLE IF NOT EXISTS ${t} `));
  assert.match(stmts, /CREATE TABLE IF NOT EXISTS plates /);
  assert.match(stmts, /CREATE TABLE IF NOT EXISTS plate_points /);
  assert.match(stmts, /CONSTRAINT anna_fk_pos_event FOREIGN KEY \(event_id\) REFERENCES anna_events\(id\)/);
  assert.match(stmts, /CONSTRAINT anna_fk_asp_event FOREIGN KEY \(event_id\) REFERENCES anna_events\(id\)/);
  assert.doesNotMatch(stmts.replace(/anna_\w+/g, ''), PERSONAL);
  // without a prefix: exactly db/schema.sql, so Docker and the learning units keep working
  assert.match(schemaStatements('').join('\n'), /CREATE TABLE IF NOT EXISTS events /);
  assert.match(readAsset('db/schema.sql'), /CONSTRAINT fk_pos_event/);
});

test('Node-RED: prefix in the tab variable and in the pending query', () => {
  const tab = buildFlowTab({ dbHost: 'db', dbPort: 3306, dbName: 'planeten_erdbeben', owner: 'Anna', tablePrefix: 'anna_' });
  assert.deepEqual(tab.env, [{ name: 'TABLE_PREFIX', value: 'anna_', type: 'str' }]);
  const poll = tab.nodes.find((n) => n.id === 'peb_poll');
  assert.match(poll.topic, /FROM anna_events WHERE sky_computed = 0/);
  assert.match(tab.info, /anna_events/);
  const legacy = buildFlowImport({ dbHost: 'db', dbPort: 3306, dbName: 'planeten_erdbeben' });
  assert.deepEqual(legacy[0].env, [{ name: 'TABLE_PREFIX', value: '', type: 'str' }]);
  assert.match(legacy.find((n) => n.id === 'peb_poll').topic, /FROM events WHERE/);
});

/** Runs a function node's code like Node-RED does (msg, node, env). */
function runFunction(code, msg, envVars, extra = {}) {
  const node = { status() {}, warn(m) { throw new Error(m); }, error(m) { throw new Error(m); } };
  const env = { get: (k) => envVars[k] };
  const names = Object.keys(extra);
  return new Function('msg', 'node', 'env', ...names, code)(msg, node, env, ...names.map((k) => extra[k]));
}

test('Node-RED functions write into the prefixed tables', () => {
  const tab = buildFlowTab({ dbHost: 'db', dbPort: 3306, dbName: 'x', tablePrefix: 'anna_' });
  const code = (id) => tab.nodes.find((n) => n.id === id).func;
  const env = { TABLE_PREFIX: 'anna_' };

  const usgs = { payload: { features: [{ id: 'us1', properties: { type: 'earthquake', mag: 6.1, time: Date.UTC(2026, 0, 2), place: 'Somewhere' }, geometry: { coordinates: [10, 20, 30] } }] } };
  const [inserts] = runFunction(code('peb_split'), usgs, env);
  assert.equal(inserts.length, 2);
  for (const m of inserts) assert.match(m.topic, /^INSERT IGNORE INTO anna_events /);

  const skyCode = readAsset('node-red/functions/compute-sky.js'); // computeSky is passed in, like the inserted planets.js
  const [writes] = runFunction(skyCode, { event: { id: 7, latitude: 20, longitude: 10, time_iso: '2026-01-02T00:00:00.000Z' } }, env, { computeSky });
  const tables = new Set(writes.map((m) => m.topic.match(/^(?:REPLACE INTO|UPDATE) (\w+)/)[1]));
  assert.ok(tables.has('anna_body_positions') && tables.has('anna_events'));
  for (const t of tables) assert.match(t, /^anna_/);

  // heliocentric columns: filled for the planets, NULL for the Sun
  const bp = writes.find((m) => m.topic.startsWith('REPLACE INTO anna_body_positions'));
  const cols = bp.topic.match(/\(([^)]+)\)/)[1].split(',');
  const rows = [];
  for (let i = 0; i < bp.payload.length; i += cols.length) rows.push(Object.fromEntries(cols.map((c, k) => [c, bp.payload[i + k]])));
  const row = (b) => rows.find((r) => r.body === b);
  assert.equal(row('Sun').helio_dist_au, null);
  assert.ok(row('Mars').helio_dist_au > 1.3 && row('Mars').helio_lon_deg >= 0);

  const [legacy] = runFunction(code('peb_split'), usgs, {});
  assert.match(legacy[0].topic, /^INSERT IGNORE INTO events /);
});

test('Grafana: every panel query reads the personal tables, plates stay shared', () => {
  const sqls = JSON.stringify(buildDashboard({ tablePrefix: 'anna_' }).panels.flatMap((p) => (p.targets || []).map((t) => t.rawSql)));
  assert.match(sqls, /anna_events/);
  assert.match(sqls, /anna_body_positions/);
  assert.match(sqls, /anna_aspects/);
  assert.match(sqls, /FROM plate_points/);
  assert.doesNotMatch(sqls.replace(/anna_\w+/g, ''), PERSONAL);
  const legacy = JSON.stringify(buildDashboard().panels.flatMap((p) => (p.targets || []).map((t) => t.rawSql)));
  assert.match(legacy, /FROM events/);
  assert.doesNotMatch(legacy, /anna_/);
});
