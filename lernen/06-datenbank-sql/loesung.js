// Einheit 06 – Musterlösung (JavaScript-Teil)

function isSafeName(name) {
  return /^[A-Za-z0-9_]{1,64}$/.test(name);
}

function buildInsert(table, cols, rows) {
  if (!isSafeName(table)) throw new Error(`Unsicherer Tabellenname: ${table}`);
  const placeholders = '(' + cols.map(() => '?').join(',') + ')';
  return {
    sql: `INSERT INTO ${table} (${cols.join(',')}) VALUES ${rows.map(() => placeholders).join(',')}`,
    params: rows.flat(),
  };
}

function unsafeQuery(place) {
  return `SELECT * FROM events WHERE place = '${place}'`;
}

// ' beendet den Text, ; beendet den Befehl, -- macht den Rest ('…) zum Kommentar
const ANGRIFF = "x'; DROP TABLE events; --";

function shares(rows) {
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  return rows.map((r) => ({ group: r.group, pct: total ? Number(((100 * r.n) / total).toFixed(1)) : 0 }));
}

module.exports = { isSafeName, buildInsert, unsafeQuery, ANGRIFF, shares };
