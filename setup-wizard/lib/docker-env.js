// Ports of the local Docker environment (compose.yaml), for the "Lokale Docker-Umgebung" button.
// compose.yaml publishes MariaDB, Node-RED and Grafana on ${DB_PORT:-3306}, ${NODERED_PORT:-1880}
// and ${GRAFANA_PORT:-3000}. Docker Compose takes these from the shell or from the .env file next to
// compose.yaml (the shell wins). Only these three keys are read: .env may also hold passwords,
// and those never leave this file.
const fs = require('node:fs');
const path = require('node:path');

const PORT_KEYS = { db: 'DB_PORT', nodered: 'NODERED_PORT', grafana: 'GRAFANA_PORT' };
const DEFAULTS = { db: 3306, nodered: 1880, grafana: 3000 };

/** KEY=VALUE lines like Docker Compose reads them (comments, quotes, "export "). Only the wanted keys. */
function parseDotEnv(text, wanted) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || !wanted.includes(m[1])) continue;
    let value = m[2].trim();
    const quoted = value.match(/^(["'])(.*)\1$/);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, '');
    out[m[1]] = value;
  }
  return out;
}

const validPort = (v) => /^\d{1,5}$/.test(String(v ?? '').trim()) && Number(v) >= 1 && Number(v) <= 65535;

/** First folder that holds compose.yaml: each start folder and up to 3 folders above it. */
function findComposeDir(startDirs) {
  for (const start of startDirs.filter(Boolean)) {
    let dir = path.resolve(start);
    for (let i = 0; i < 4; i++) {
      if (fs.existsSync(path.join(dir, 'compose.yaml'))) return dir;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

/**
 * @param {{startDirs?: string[], env?: object}} [opts]
 * @returns {{ports: {db:number, nodered:number, grafana:number}, envFile: string|null, composeDir: string|null}}
 */
function dockerPorts({ startDirs, env = process.env } = {}) {
  const dirs = startDirs || [process.cwd(), path.dirname(process.execPath), path.join(__dirname, '..', '..')];
  const composeDir = findComposeDir(dirs);
  const envFile = composeDir && fs.existsSync(path.join(composeDir, '.env')) ? path.join(composeDir, '.env') : null;
  const fromFile = envFile ? parseDotEnv(fs.readFileSync(envFile, 'utf8'), Object.values(PORT_KEYS)) : {};
  const ports = {};
  for (const [part, key] of Object.entries(PORT_KEYS)) {
    const value = [env[key], fromFile[key]].find(validPort);
    ports[part] = value ? Number(value) : DEFAULTS[part];
  }
  return { ports, envFile, composeDir };
}

module.exports = { dockerPorts, parseDotEnv, findComposeDir, DEFAULTS };
