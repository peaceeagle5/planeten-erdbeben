// Database step: test the connection, create the database and tables.
const mysql = require('mysql2/promise');
const { readAsset } = require('../../shared/assets');
const { normalizePrefix, withPrefix, tableNames } = require('../../shared/tables');

function checkName(name, user) {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(name || '')) throw new Error('Datenbankname darf nur Buchstaben, Ziffern und _ enthalten.');
  // an empty user would log in anonymously on some MariaDB installs and see nothing
  if (user !== undefined && !String(user).trim()) throw new Error('Bitte den Datenbank-Benutzer eintragen (frag deine Lehrkraft, falls du ihn nicht kennst).');
}

function connect(cfg, withDatabase) {
  return mysql.createConnection({
    host: cfg.host, port: Number(cfg.port) || 3306, user: cfg.user, password: cfg.password,
    database: withDatabase ? cfg.database : undefined, connectTimeout: 8000, timezone: 'Z',
  });
}

/** Turns driver errors into explanations pupils can act on. */
function explain(err, cfg) {
  const where = `${cfg.host}:${cfg.port}`;
  switch (err.code) {
    case 'ECONNREFUSED':
      return `Keine Datenbank unter ${where} erreichbar. Läuft MariaDB/MySQL? Auf dem Raspberry Pi hört MariaDB ` +
        `standardmäßig nur auf 127.0.0.1: in /etc/mysql/mariadb.conf.d/50-server.cnf "bind-address = 0.0.0.0" setzen ` +
        `und "sudo systemctl restart mariadb" ausführen.`;
    case 'ETIMEDOUT': case 'EHOSTUNREACH': case 'ENETUNREACH':
      return `${where} antwortet nicht. Stimmt die IP-Adresse, und ist der Rechner im selben Netzwerk?`;
    case 'ENOTFOUND':
      return `Der Name "${cfg.host}" ist unbekannt. Am besten die IP-Adresse eintragen.`;
    case 'ER_ACCESS_DENIED_ERROR':
      return `Benutzername oder Passwort für die Datenbank ist falsch.`;
    case 'ER_HOST_NOT_PRIVILEGED': case 'ER_HOST_IS_BLOCKED':
      return `Der Datenbank-Benutzer darf sich nicht von diesem Rechner aus anmelden. ` +
        `Auf dem Server z. B.: CREATE USER 'name'@'%' IDENTIFIED BY '...'; GRANT ALL ON ${cfg.database}.* TO 'name'@'%';`;
    case 'ER_DBACCESS_DENIED_ERROR':
      return `Der Benutzer hat keine Rechte für die Datenbank "${cfg.database}".`;
    default:
      return `${err.code || 'Fehler'}: ${err.message}`;
  }
}

async function testDb(cfg) {
  let prefix;
  try { checkName(cfg.database, cfg.user || ""); prefix = normalizePrefix(cfg.tablePrefix); } catch (err) { return { ok: false, message: err.message }; }
  let conn;
  try {
    conn = await connect(cfg, false);
    const [[{ v }]] = await conn.query('SELECT VERSION() AS v');
    const [dbs] = await conn.query('SHOW DATABASES LIKE ?', [cfg.database]);
    let tables = [];
    if (dbs.length) [tables] = await conn.query(`SHOW TABLES FROM \`${cfg.database}\``);
    const exists = dbs.length > 0;
    const names = new Set(tables.map((r) => Object.values(r)[0].toLowerCase()));
    const events = tableNames(prefix).events;
    let mine = `Deine Tabellen (${events}, ...) werden angelegt.`;
    if (names.has(events)) {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${cfg.database}\`.\`${events}\` WHERE kind = 'earthquake'`);
      mine = `Deine Tabellen (${events}, ...) gibt es schon, mit ${n} Erdbeben. Sie werden weiterverwendet.`;
    }
    return {
      ok: true,
      message: `Verbunden mit ${v.includes('MariaDB') ? 'MariaDB' : 'MySQL'} ${v.split('-')[0]}. ` +
        (exists ? `Datenbank "${cfg.database}" gibt es schon (${tables.length} Tabellen). ` : `Datenbank "${cfg.database}" wird angelegt. `) + mine,
    };
  } catch (err) {
    return { ok: false, message: explain(err, cfg) };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

/**
 * Schema statements without CREATE DATABASE / USE (the wizard handles those),
 * with the personal tables renamed for this person (see shared/tables.js).
 */
function schemaStatements(prefix = '') {
  return readAsset('db/schema.sql')
    .split(';\n')
    .map((s) => s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
    .filter((s) => s && !/^(CREATE DATABASE|USE)\b/i.test(s))
    .map((s) => withPrefix(s, prefix));
}

/**
 * Columns that came after the first version of db/schema.sql. CREATE TABLE IF NOT EXISTS does not
 * change a table that already exists, so setupDb adds them with ALTER TABLE. [table, column, definition]
 */
const ADDED_COLUMNS = [
  ['body_positions', 'helio_lon_deg', 'DOUBLE NULL AFTER retrograde'],
  ['body_positions', 'helio_dist_au', 'DOUBLE NULL AFTER helio_lon_deg'],
];

async function addMissingColumns(conn, prefix, log) {
  for (const [base, column, definition] of ADDED_COLUMNS) {
    const table = tableNames(prefix)[base];
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    if (cols.length) continue;
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    log(`Spalte ${column} in ${table} ergänzt.`);
  }
}

/**
 * Events computed before the heliocentric columns existed have NULL there. Setting them back to
 * "pending" lets Node-RED compute them again (REPLACE overwrites the old rows). Returns the count.
 */
async function requeueWithoutHelio(conn, prefix) {
  const t = tableNames(prefix);
  const [res] = await conn.query(
    `UPDATE \`${t.events}\` SET sky_computed = 0 WHERE sky_computed = 1 AND id IN ` +
    `(SELECT event_id FROM \`${t.body_positions}\` WHERE body <> 'Sun' AND helio_dist_au IS NULL)`);
  return res.affectedRows;
}

/** Same as the last step of setupDb, on its own: used again after the new Node-RED flow is deployed. */
async function requeueOldEvents(cfg, log) {
  const prefix = normalizePrefix(cfg.tablePrefix);
  const conn = await connect(cfg, true);
  try {
    const n = await requeueWithoutHelio(conn, prefix);
    if (n) log(`${n} ältere Events werden neu berechnet (Positionen von der Sonne aus fehlten noch).`);
    return n;
  } finally {
    await conn.end().catch(() => {});
  }
}

async function setupDb(cfg, log) {
  checkName(cfg.database, cfg.user || "");
  const prefix = normalizePrefix(cfg.tablePrefix);
  let conn;
  try {
    conn = await connect(cfg, false);
    try {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4`);
      log(`Datenbank "${cfg.database}" ist bereit.`);
    } catch (err) {
      // users without CREATE rights can still use an existing database
      const [dbs] = await conn.query('SHOW DATABASES LIKE ?', [cfg.database]);
      if (!dbs.length) throw err;
      log(`Datenbank "${cfg.database}" existiert (keine Rechte zum Anlegen, das ist ok).`);
    }
    await conn.query(`USE \`${cfg.database}\``);
    const [rows] = await conn.query('SHOW TABLES');
    const existing = new Set(rows.map((r) => Object.values(r)[0].toLowerCase()));
    for (const sql of schemaStatements(prefix)) {
      const table = (sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i) || [])[1];
      if (table && existing.has(table.toLowerCase())) { log(`Tabelle ${table} gibt es schon.`); continue; }
      await conn.query(sql);
      if (table) log(`Tabelle ${table} angelegt.`);
    }
    await addMissingColumns(conn, prefix, log);
    const n = await requeueWithoutHelio(conn, prefix);
    if (n) log(`${n} ältere Events werden neu berechnet (Positionen von der Sonne aus fehlten noch). Das dauert ein paar Minuten.`);
  } catch (err) {
    throw new Error(explain(err, cfg));
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

async function countEvents(cfg) {
  const events = tableNames(normalizePrefix(cfg.tablePrefix)).events;
  const conn = await connect(cfg, true);
  try {
    const [[row]] = await conn.query(
      "SELECT SUM(kind = 'earthquake') AS quakes, COUNT(*) AS total, " +
      `COALESCE(SUM(sky_computed = 1), 0) AS computed, COALESCE(SUM(sky_computed = 0), 0) AS pending FROM \`${events}\``);
    return { quakes: Number(row.quakes || 0), total: Number(row.total), computed: Number(row.computed), pending: Number(row.pending) };
  } finally {
    await conn.end().catch(() => {});
  }
}

module.exports = { testDb, setupDb, countEvents, requeueOldEvents, schemaStatements, ADDED_COLUMNS, explainDbError: explain };
