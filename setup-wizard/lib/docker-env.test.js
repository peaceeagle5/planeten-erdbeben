// Tests for reading the Docker ports from .env: node --test setup-wizard/lib/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dockerPorts, parseDotEnv, DEFAULTS } = require('./docker-env');

const KEYS = ['DB_PORT', 'NODERED_PORT', 'GRAFANA_PORT'];

function project(envText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-docker-env-'));
  fs.writeFileSync(path.join(dir, 'compose.yaml'), 'services: {}\n');
  if (envText !== undefined) fs.writeFileSync(path.join(dir, '.env'), envText);
  fs.mkdirSync(path.join(dir, 'dist'));
  return dir;
}

test('parseDotEnv reads only the wanted keys, like Docker Compose', () => {
  const text = '# comment\nDB_PORT=3307\nexport NODERED_PORT = "1881"\nGRAFANA_PORT=3001 # next to another Grafana\nDB_PASSWORD=secret\n';
  assert.deepEqual(parseDotEnv(text, KEYS), { DB_PORT: '3307', NODERED_PORT: '1881', GRAFANA_PORT: '3001' });
  assert.deepEqual(parseDotEnv('DB_PORT=\'3308\'\r\n', KEYS), { DB_PORT: '3308' });
});

test('ports from .env next to compose.yaml, also when started from a subfolder (dist/)', () => {
  const dir = project('DB_PORT=3307\nDB_PASSWORD=secret\n');
  const r = dockerPorts({ startDirs: [path.join(dir, 'dist')], env: {} });
  assert.deepEqual(r.ports, { db: 3307, nodered: 1880, grafana: 3000 });
  assert.equal(r.envFile, path.join(dir, '.env'));
  assert.ok(!JSON.stringify(r).includes('secret'), 'passwords never leave .env');
});

test('the shell wins over .env, invalid values fall back', () => {
  const dir = project('DB_PORT=3307\nGRAFANA_PORT=abc\n');
  const r = dockerPorts({ startDirs: [dir], env: { DB_PORT: '3310', NODERED_PORT: '99999' } });
  assert.deepEqual(r.ports, { db: 3310, nodered: 1880, grafana: 3000 });
});

test('no .env or no compose.yaml: standard ports', () => {
  assert.deepEqual(dockerPorts({ startDirs: [project()], env: {} }).ports, DEFAULTS);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-no-compose-'));
  const r = dockerPorts({ startDirs: [empty], env: {} });
  assert.deepEqual(r.ports, DEFAULTS);
  assert.equal(r.envFile, null);
});
