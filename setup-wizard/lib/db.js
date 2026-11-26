// Database step: test the connection, create the database and tables.
const mysql = require('mysql2/promise');
const { readAsset } = require('../../shared/assets');
const { normalizePrefix, withPrefix, tableNames } = require('../../shared/tables');
const { SPEC, checkStructure } = require('../../shared/schema-spec');

/** How the personal tables come into the database (database card in the wizard). */
const TABLE_MODES = ['auto', 'write', 'copy'];
const tableMode = (cfg) => (TABLE_MODES.includes(cfg.mode) ? cfg.mode : 'auto');

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
    let mine = tableMode(cfg) === 'auto'
      ? `Deine Tabellen (${events}, ...) werden angelegt.`
      : `Deine Tabellen (${events}, ...) gibt es noch nicht: ${tableMode(cfg) === 'write' ? 'schreibe' : 'füge'} sie unten ein und prüfe sie.`;
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

// ------------------------------------------------------------------ tables by hand (write / copy)

/** db/schema.sql with comments, for copying: this person's prefix, USE instead of CREATE DATABASE. */
function schemaSql(cfg) {
  checkName(cfg.database);
  const prefix = normalizePrefix(cfg.tablePrefix);
  const schema = readAsset('db/schema.sql');
  const text = schema.slice(schema.search(/^USE /m)) // the file's header comment is about the project, not for pupils
    .replace(/^USE [^\n]*\n/m, `USE \`${cfg.database}\`;\n`);
  return `-- Tabellen für Planeten & Erdbeben${prefix ? `, Präfix "${prefix}"` : ''}.\n` +
    '-- Alles kopieren, in ein SQL-Programm (oder das Feld im Setup) einfügen und ausführen.\n' + withPrefix(text, prefix);
}

/** Reads columns, keys and foreign keys of the personal tables from information_schema. */
async function readStructure(conn, database, prefix) {
  const names = Object.keys(SPEC).map((b) => (prefix + b).toLowerCase());
  const where = 'WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) IN (?)';
  const [cols] = await conn.query('SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, ' +
    `CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS ${where} ORDER BY TABLE_NAME, ORDINAL_POSITION`, [database, names]);
  const [stats] = await conn.query('SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME FROM information_schema.STATISTICS ' +
    `${where} ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [database, names]);
  const [fks] = await conn.query('SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE ' +
    `${where} AND REFERENCED_TABLE_NAME IS NOT NULL`, [database, names]);

  const structure = {};
  for (const base of Object.keys(SPEC)) {
    const name = (prefix + base).toLowerCase();
    const own = (rows) => rows.filter((r) => r.TABLE_NAME.toLowerCase() === name);
    const columns = own(cols).map((c) => ({
      name: c.COLUMN_NAME, dataType: c.DATA_TYPE, columnType: c.COLUMN_TYPE, nullable: c.IS_NULLABLE === 'YES',
      // MariaDB reports a missing default of a nullable column as the text 'NULL'
      def: c.COLUMN_DEFAULT === 'NULL' ? null : c.COLUMN_DEFAULT, extra: c.EXTRA, maxLen: c.CHARACTER_MAXIMUM_LENGTH,
    }));
    if (!columns.length) { structure[base] = null; continue; }
    const indexes = new Map();
    for (const s of own(stats)) {
      if (!indexes.has(s.INDEX_NAME)) indexes.set(s.INDEX_NAME, { unique: Number(s.NON_UNIQUE) === 0, cols: [] });
      indexes.get(s.INDEX_NAME).cols.push(s.COLUMN_NAME);
    }
    structure[base] = {
      name, columns,
      primaryKey: (indexes.get('PRIMARY') || { cols: [] }).cols,
      uniques: [...indexes].filter(([n, i]) => n !== 'PRIMARY' && i.unique).map(([, i]) => i.cols),
      indexes: [...indexes].filter(([n, i]) => n !== 'PRIMARY' && !i.unique).map(([, i]) => i.cols),
      foreignKeys: own(fks).map((f) => ({ column: f.COLUMN_NAME, refTable: f.REFERENCED_TABLE_NAME })),
    };
  }
  return structure;
}

/** Checks the personal tables against shared/schema-spec.js. */
async function checkTables(cfg) {
  checkName(cfg.database, cfg.user || '');
  const prefix = normalizePrefix(cfg.tablePrefix);
  let conn;
  try {
    conn = await connect(cfg, true);
    return { prefix, ...checkStructure(await readStructure(conn, cfg.database, prefix), prefix) };
  } catch (err) {
    throw new Error(explain(err, cfg));
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

/** Explains errors of SQL the pupils wrote themselves. */
function explainSql(err) {
  const hints = {
    ER_PARSE_ERROR: 'Tippfehler im SQL. Die Stelle steht nach „near“: Fehlt dort ein Komma, eine Klammer oder ein Semikolon?',
    ER_TABLE_EXISTS_ERROR: 'Die Tabelle gibt es schon. Ändern mit ALTER TABLE, oder neu: erst DROP TABLE (löscht die Daten darin!).',
    ER_DUP_FIELDNAME: 'Eine Spalte steht zweimal in der Tabelle.',
    ER_CANT_CREATE_TABLE: 'Oft der Fremdschlüssel: events muss zuerst angelegt sein, und event_id braucht genau denselben Typ wie events.id (z. B. beide INT UNSIGNED).',
    ER_FK_INCOMPATIBLE_COLUMNS: 'Der Fremdschlüssel passt nicht: event_id braucht genau denselben Typ wie events.id (z. B. beide INT UNSIGNED).',
    ER_CANNOT_ADD_FOREIGN: 'Der Fremdschlüssel passt nicht: Gibt es die Tabelle events schon, und haben event_id und events.id denselben Typ?',
    ER_NO_SUCH_TABLE: 'Diese Tabelle gibt es (noch) nicht. Stimmt der Name mit deinem Präfix?',
    ER_TABLEACCESS_DENIED_ERROR: 'Dein Datenbank-Benutzer darf das nicht. Frag deine Lehrkraft.',
    ER_DBACCESS_DENIED_ERROR: 'Dein Datenbank-Benutzer darf das nicht. Frag deine Lehrkraft.',
    ER_MULTIPLE_PRI_KEY: 'Die Tabelle hat schon einen Primärschlüssel: ALTER TABLE … DROP PRIMARY KEY, ADD PRIMARY KEY (…).',
    ER_TOO_LONG_KEY: 'Der Schlüssel ist zu lang: VARCHAR-Spalten im Schlüssel kürzer machen (z. B. VARCHAR(64)).',
  };
  return `${err.sqlMessage || err.message}${hints[err.code] ? `\n→ ${hints[err.code]}` : ''}`;
}

/** Runs SQL typed or pasted into the wizard (one or more statements) with the person's own login. */
async function runSql(cfg, sql) {
  checkName(cfg.database, cfg.user || '');
  const text = String(sql || '').trim();
  if (!text) return { ok: false, message: 'Das Feld ist leer.' };
  if (text.length > 200000) return { ok: false, message: 'Das ist zu viel SQL auf einmal.' };
  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host, port: Number(cfg.port) || 3306, user: cfg.user, password: cfg.password, database: cfg.database,
      connectTimeout: 8000, timezone: 'Z', multipleStatements: true,
    });
  } catch (err) {
    return { ok: false, message: explain(err, cfg) };
  }
  try {
    await conn.query(text);
    return { ok: true, message: 'SQL ausgeführt. Jetzt „Tabellen prüfen“.' };
  } catch (err) {
    return { ok: false, message: explainSql(err) };
  } finally {
    await conn.end().catch(() => {});
  }
}

/** The shared plate tables are not part of the exercise: create them if they are missing. */
async function ensureSharedTables(conn, log) {
  const [rows] = await conn.query('SHOW TABLES');
  const existing = new Set(rows.map((r) => Object.values(r)[0].toLowerCase()));
  for (const sql of schemaStatements('')) {
    const table = (sql.match(/CREATE TABLE IF NOT EXISTS (plates|plate_points)\b/i) || [])[1];
    if (!table || existing.has(table)) continue;
    await conn.query(sql);
    log(`Gemeinsame Tabelle ${table} angelegt.`);
  }
}

/** Database step for "write" and "copy": the person's tables must be complete before Node-RED starts. */
async function verifyDb(cfg, log) {
  checkName(cfg.database, cfg.user || '');
  const prefix = normalizePrefix(cfg.tablePrefix);
  let conn;
  try {
    conn = await connect(cfg, true);
    await ensureSharedTables(conn, log);
    const result = checkStructure(await readStructure(conn, cfg.database, prefix), prefix);
    for (const h of result.hints) log(`Tipp (${h.table}): ${h.text}`);
    if (!result.ok) {
      const first = result.errors.slice(0, 3).map((e) => `${e.table}: ${e.text}`).join(' ');
      throw Object.assign(new Error(`Deine Tabellen sind noch nicht fertig (${result.errors.length} Punkt${result.errors.length === 1 ? '' : 'e'}). ${first} ` +
        'Oben bei der Datenbank „Tabellen prüfen“ zeigt alles mit Lösungsvorschlag.'), { tablesIncomplete: true });
    }
    log(`Deine Tabellen ${Object.keys(SPEC).map((b) => prefix + b).join(', ')} sind in Ordnung.`);
    const n = await requeueWithoutHelio(conn, prefix);
    if (n) log(`${n} ältere Events werden neu berechnet.`);
  } catch (err) {
    if (err.tablesIncomplete) throw err;
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

module.exports = {
  testDb, setupDb, verifyDb, checkTables, runSql, schemaSql, readStructure, countEvents, requeueOldEvents, schemaStatements,
  tableMode, TABLE_MODES, ADDED_COLUMNS, explainDbError: explain,
};
