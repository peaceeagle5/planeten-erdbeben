// Database step: test the connection, create the database and tables.
const mysql = require('mysql2/promise');
const { readAsset } = require('../../shared/assets');

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
  try { checkName(cfg.database, cfg.user || ""); } catch (err) { return { ok: false, message: err.message }; }
  let conn;
  try {
    conn = await connect(cfg, false);
    const [[{ v }]] = await conn.query('SELECT VERSION() AS v');
    const [dbs] = await conn.query('SHOW DATABASES LIKE ?', [cfg.database]);
    let tables = [];
    if (dbs.length) [tables] = await conn.query(`SHOW TABLES FROM \`${cfg.database}\``);
    const exists = dbs.length > 0;
    return {
      ok: true,
      message: `Verbunden mit ${v.includes('MariaDB') ? 'MariaDB' : 'MySQL'} ${v.split('-')[0]}. ` +
        (exists ? `Datenbank "${cfg.database}" gibt es schon (${tables.length} Tabellen).` : `Datenbank "${cfg.database}" wird angelegt.`),
    };
  } catch (err) {
    return { ok: false, message: explain(err, cfg) };
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

/** Schema statements without CREATE DATABASE / USE (the wizard handles those). */
function schemaStatements() {
  return readAsset('db/schema.sql')
    .split(';\n')
    .map((s) => s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
    .filter((s) => s && !/^(CREATE DATABASE|USE)\b/i.test(s));
}

async function setupDb(cfg, log) {
  checkName(cfg.database, cfg.user || "");
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
    for (const sql of schemaStatements()) {
      const table = (sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i) || [])[1];
      if (table && existing.has(table.toLowerCase())) { log(`Tabelle ${table} gibt es schon.`); continue; }
      await conn.query(sql);
      if (table) log(`Tabelle ${table} angelegt.`);
    }
  } catch (err) {
    throw new Error(explain(err, cfg));
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

async function countEvents(cfg) {
  const conn = await connect(cfg, true);
  try {
    const [[row]] = await conn.query(
      "SELECT SUM(kind = 'earthquake') AS quakes, COUNT(*) AS total, " +
      'COALESCE(SUM(sky_computed = 1), 0) AS computed, COALESCE(SUM(sky_computed = 0), 0) AS pending FROM events');
    return { quakes: Number(row.quakes || 0), total: Number(row.total), computed: Number(row.computed), pending: Number(row.pending) };
  } finally {
    await conn.end().catch(() => {});
  }
}

module.exports = { testDb, setupDb, countEvents, explainDbError: explain };
