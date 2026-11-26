// Tests: Anforderungen an die eigenen Tabellen (Übung "Tabellen selbst schreiben"). node --test shared/
const test = require('node:test');
const assert = require('node:assert/strict');
const { SPEC, checkStructure } = require('./schema-spec');
const { readAsset } = require('./assets');

/** Liest CREATE TABLE aus db/schema.sql so, wie information_schema es liefern würde (vereinfacht). */
function structureFromSql(sql, prefix = '') {
  const out = {};
  for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\)\s*ENGINE/g)) {
    const base = m[1].slice(prefix.length);
    if (!SPEC[base]) continue;
    const t = { name: m[1], columns: [], primaryKey: [], uniques: [], indexes: [], foreignKeys: [] };
    for (const raw of m[2].split('\n')) {
      const line = raw.replace(/--.*$/, '').trim().replace(/,$/, '');
      if (!line) continue;
      let k;
      if ((k = line.match(/^PRIMARY KEY \(([^)]+)\)/))) t.primaryKey = k[1].split(',').map((s) => s.trim());
      else if ((k = line.match(/^UNIQUE KEY \w+ \(([^)]+)\)/))) t.uniques.push(k[1].split(',').map((s) => s.trim()));
      else if ((k = line.match(/^(?:SPATIAL )?KEY \w+ \(([^)]+)\)/))) t.indexes.push(k[1].split(',').map((s) => s.trim()));
      else if ((k = line.match(/FOREIGN KEY \((\w+)\) REFERENCES (\w+)/))) t.foreignKeys.push({ column: k[1], refTable: k[2] });
      else if ((k = line.match(/^(\w+)\s+([A-Z]+)(\([^)]*\))?(\s+UNSIGNED)?(.*)$/))) {
        const [, name, type, size, unsigned, rest] = k;
        if (/PRIMARY KEY/.test(rest)) t.primaryKey = [name];
        t.columns.push({
          name, dataType: type.toLowerCase(), columnType: `${type.toLowerCase()}${size || ''}${unsigned ? ' unsigned' : ''}`,
          nullable: !/NOT NULL/.test(rest) && !/PRIMARY KEY/.test(rest),
          def: (rest.match(/DEFAULT (\S+)/) || [])[1] ?? null,
          extra: /AUTO_INCREMENT/.test(rest) ? 'auto_increment' : '',
          maxLen: /CHAR/.test(type) ? Number((size || '(1)').slice(1, -1)) : type === 'ENUM' ? 11 : null,
        });
      }
    }
    out[base] = t;
  }
  return out;
}

const schema = readAsset('db/schema.sql');
const good = () => JSON.parse(JSON.stringify(structureFromSql(schema)));
const texts = (r) => r.errors.map((e) => e.text).join('\n');

test('die Musterlösung db/schema.sql besteht die Prüfung, ohne Tipps', () => {
  const r = checkStructure(good());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.hints, []);
});

test('jede verlangte Spalte steht in db/schema.sql, mit derselben NULL-Regel', () => {
  const s = good();
  for (const [base, spec] of Object.entries(SPEC)) {
    for (const c of spec.columns) {
      const col = s[base].columns.find((x) => x.name === c.name);
      assert.ok(col, `${base}.${c.name}`);
      if (c.nullable) assert.equal(col.nullable, true, `${base}.${c.name} muss NULL erlauben`);
    }
  }
});

test('fehlende Tabelle, fehlende Spalte, falscher Typ', () => {
  const s = good();
  delete s.aspects;
  s.events.columns = s.events.columns.filter((c) => c.name !== 'magnitude');
  Object.assign(s.body_positions.columns.find((c) => c.name === 'altitude_deg'), { dataType: 'varchar', columnType: 'varchar(10)', maxLen: 10 });
  const r = checkStructure(s, '');
  assert.equal(r.ok, false);
  assert.match(texts(r), /Die Tabelle aspects fehlt/);
  assert.match(texts(r), /Spalte magnitude fehlt/);
  assert.match(texts(r), /altitude_deg ist varchar\(10\), muss aber eine Zahl/);
  const fix = r.errors.find((e) => /magnitude fehlt/.test(e.text)).fix;
  assert.equal(fix, 'ALTER TABLE events ADD COLUMN magnitude DOUBLE NULL;');
});

test('die Fehler, die Node-RED stillschweigend lahmlegen würden', () => {
  const s = good();
  s.events.uniques = [];                                                         // Beben würden alle 5 min doppelt gespeichert
  Object.assign(s.events.columns.find((c) => c.name === 'sky_computed'), { def: null }); // nie berechnet
  Object.assign(s.events.columns.find((c) => c.name === 'place'), { nullable: false });   // Kontrollen haben keinen Ort
  Object.assign(s.events.columns.find((c) => c.name === 'id'), { extra: '' });
  s.body_positions.primaryKey = [];                                              // jede Neuberechnung doppelt
  Object.assign(s.body_positions.columns.find((c) => c.name === 'helio_dist_au'), { nullable: false }); // Sonne: NULL
  Object.assign(s.aspects.columns.find((c) => c.name === 'aspect'), { maxLen: 8, columnType: 'varchar(8)' }); // 'conjunction'
  const r = checkStructure(s);
  const t = texts(r);
  assert.match(t, /source_id braucht einen UNIQUE-Schlüssel/);
  assert.match(t, /sky_computed braucht DEFAULT 0/);
  assert.match(t, /place muss leer \(NULL\) sein dürfen/);
  assert.match(t, /id braucht AUTO_INCREMENT/);
  assert.match(t, /Es fehlt der Primärschlüssel \(event_id, body\)/);
  assert.match(t, /helio_dist_au muss leer \(NULL\) sein dürfen/);
  assert.match(t, /In aspect passen nur 8 Zeichen, nötig sind mindestens 11/);
  assert.equal(r.errors.length, 7);
});

test('ENUM ohne einen Wert, zusätzliche Pflichtspalte, Hinweise statt Fehler', () => {
  const s = good();
  Object.assign(s.events.columns.find((c) => c.name === 'kind'), { columnType: "enum('earthquake')" });
  s.events.columns.push({ name: 'country', dataType: 'varchar', columnType: 'varchar(40)', nullable: false, def: null, extra: '', maxLen: 40 });
  s.body_positions.foreignKeys = [];
  Object.assign(s.events.columns.find((c) => c.name === 'time_utc'), { columnType: 'datetime' });
  Object.assign(s.events.columns.find((c) => c.name === 'latitude'), { dataType: 'float', columnType: 'float' });
  const r = checkStructure(s);
  assert.match(texts(r), /In ENUM von kind fehlt 'control'/);
  assert.match(texts(r), /Zusätzliche Spalte country ist NOT NULL ohne DEFAULT/);
  assert.equal(r.errors.length, 2);
  const hints = r.hints.map((h) => h.text).join('\n');
  assert.match(hints, /Kein Fremdschlüssel event_id → events\(id\)/);
  assert.match(hints, /time_utc speichert keine Millisekunden/);
  assert.match(hints, /latitude ist FLOAT/);
  Object.assign(s.events.columns.find((c) => c.name === 'place'), { maxLen: 40, columnType: 'varchar(40)' });
  const r2 = checkStructure(s);
  assert.equal(r2.errors.length, 2, 'ein zu kurzer Ort ist kein Fehler ...');
  assert.match(r2.hints.map((h) => h.text).join('\n'), /In place passen nur 40 Zeichen/, '... sondern ein Tipp');
});

test('mit Präfix: Tabellennamen und Lösungsvorschläge tragen ihn', () => {
  const s = structureFromSql(schema.replace(/\b(events|body_positions|aspects)\b/g, 'anna_$1'), 'anna_');
  assert.ok(checkStructure(s, 'anna_').ok);
  delete s.events;
  const r = checkStructure(s, 'anna_');
  assert.match(texts(r), /Die Tabelle anna_events fehlt/);
});
