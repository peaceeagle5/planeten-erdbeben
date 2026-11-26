// Personal tables: several people share ONE database, and everyone gets their own tables
// with their name in front, e.g. "anna_events", "anna_body_positions", "anna_aspects".
// The tectonic plates (plates, plate_points) are the same for everyone and stay shared.
// An empty prefix means the plain names (events, ...), as in db/schema.sql and the learning units.

const PERSONAL_TABLES = ['events', 'body_positions', 'aspects'];
const PREFIX_RE = /^[a-z][a-z0-9_]{0,23}_$/;
const TABLE_RE = new RegExp(`\\b(${PERSONAL_TABLES.join('|')})\\b`, 'g');

/** "Anna Müller" -> "anna_mueller_", "Pascal B." -> "pascal_b_", "" -> "". */
function prefixFromName(name) {
  let p = String(name || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // é -> e
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 23).replace(/_+$/, '');
  if (!p) return '';
  if (!/^[a-z]/.test(p)) p = `t${p}`.slice(0, 23);
  return `${p}_`;
}

/** Checks a prefix typed by hand; adds the trailing "_" if missing. Throws a German message if invalid. */
function normalizePrefix(prefix) {
  let p = String(prefix ?? '').trim().toLowerCase();
  if (!p) return '';
  if (!p.endsWith('_')) p += '_';
  if (!PREFIX_RE.test(p)) {
    throw new Error('Der Tabellen-Präfix darf nur Kleinbuchstaben (a–z), Ziffern und _ enthalten, muss mit einem Buchstaben anfangen und höchstens 24 Zeichen lang sein.');
  }
  return p;
}

/**
 * Puts the prefix in front of every personal table name in an SQL text, and in front of
 * constraint names (those must be unique in the whole database). Plates stay as they are.
 */
function withPrefix(sql, prefix) {
  if (!prefix) return sql;
  return sql
    .replace(TABLE_RE, (name) => prefix + name)
    .replace(/\bCONSTRAINT\s+(\w+)/gi, (m, name) => m.replace(name, prefix + name));
}

/** {events: 'anna_events', body_positions: ..., aspects: ...} */
function tableNames(prefix) {
  return Object.fromEntries(PERSONAL_TABLES.map((t) => [t, (prefix || '') + t]));
}

module.exports = { PERSONAL_TABLES, prefixFromName, normalizePrefix, withPrefix, tableNames };
