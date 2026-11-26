// Was die eigenen Tabellen können müssen, damit Node-RED und Grafana mit ihnen arbeiten.
// Daraus entstehen im Setup-Assistenten die Aufgabe "Tabellen selbst schreiben" und die Prüfung.
// db/schema.sql ist die Musterlösung (ein Test prüft, dass beide zusammenpassen).
//
// Typ-Familien: int (TINYINT … BIGINT), number (DOUBLE, FLOAT, DECIMAL, auch int), text (VARCHAR, CHAR,
// TEXT, ENUM), datetime (DATETIME, TIMESTAMP).
// nullable: true = Node-RED schreibt dort manchmal NULL (z. B. bei der Sonne), die Spalte MUSS NULL erlauben.
// minLen: so viele Zeichen müssen hineinpassen (sonst bricht das Schreiben ab oder Werte werden abgeschnitten).
// softMinLen: zu kurz ist nur ein Tipp (z. B. place: ein langer Ortsname wird gekürzt, sonst passiert nichts).

const SPEC = {
  events: {
    purpose: 'Eine Zeile pro Erdbeben und pro Kontroll-Event (gleicher Ort, zufällige Zeit).',
    columns: [
      { name: 'id', family: 'int', autoIncrement: true, type: 'INT UNSIGNED AUTO_INCREMENT', desc: 'fortlaufende Nummer, zählt die Datenbank selbst hoch' },
      { name: 'kind', family: 'text', values: ['earthquake', 'control'], type: "ENUM('earthquake','control')", desc: "Art: 'earthquake' oder 'control'" },
      { name: 'source_id', family: 'text', minLen: 25, type: 'VARCHAR(64)', desc: "Kennung von USGS, bei Kontrollen 'ctrl-' + Kennung. Jede nur einmal!" },
      { name: 'paired_with', family: 'text', minLen: 25, nullable: true, type: 'VARCHAR(64)', desc: 'nur bei Kontrollen: source_id des Bebens, sonst leer' },
      { name: 'time_utc', family: 'datetime', type: 'DATETIME(3)', desc: 'Zeitpunkt in UTC, mit Millisekunden' },
      { name: 'latitude', family: 'number', type: 'DOUBLE', desc: 'geografische Breite in Grad' },
      { name: 'longitude', family: 'number', type: 'DOUBLE', desc: 'geografische Länge in Grad' },
      { name: 'depth_km', family: 'number', nullable: true, type: 'DOUBLE', desc: 'Tiefe in km' },
      { name: 'magnitude', family: 'number', nullable: true, type: 'DOUBLE', desc: 'Stärke' },
      { name: 'place', family: 'text', minLen: 64, softMinLen: true, nullable: true, type: 'VARCHAR(255)', desc: 'Ortsbeschreibung, bei Kontrollen leer' },
      { name: 'moon_phase_deg', family: 'number', nullable: true, type: 'DOUBLE', desc: 'Mondphase, trägt Node-RED später ein' },
      { name: 'sky_computed', family: 'int', default0: true, type: 'TINYINT(1) DEFAULT 0', desc: '0 = Positionen fehlen noch, 1 = berechnet. Muss von selbst 0 sein!' },
    ],
    primaryKey: ['id'],
    unique: [['source_id']],
    foreignKeys: [],
    recommendedIndexes: [['kind', 'time_utc'], ['magnitude']],
  },
  body_positions: {
    purpose: 'Die Position jedes Himmelskörpers (Sonne, Mond, Merkur … Pluto) bei jedem Event: 10 Zeilen pro Event.',
    columns: [
      { name: 'event_id', family: 'int', type: 'INT UNSIGNED', desc: 'zu welchem Event (id aus events)' },
      { name: 'body', family: 'text', minLen: 7, type: 'VARCHAR(16)', desc: "Name des Körpers, z. B. 'Jupiter'" },
      { name: 'ra_hours', family: 'number', type: 'DOUBLE', desc: 'Rektaszension in Stunden' },
      { name: 'dec_deg', family: 'number', type: 'DOUBLE', desc: 'Deklination in Grad' },
      { name: 'distance_au', family: 'number', type: 'DOUBLE', desc: 'Abstand von der Erde in AE' },
      { name: 'azimuth_deg', family: 'number', type: 'DOUBLE', desc: 'Himmelsrichtung am Bebenort' },
      { name: 'altitude_deg', family: 'number', type: 'DOUBLE', desc: 'Höhe über dem Horizont am Bebenort' },
      { name: 'above_horizon', family: 'int', type: 'TINYINT(1)', desc: '1 = über dem Horizont' },
      { name: 'ecl_lon_deg', family: 'number', type: 'DOUBLE', desc: 'ekliptische Länge (von der Erde aus)' },
      { name: 'ecl_lat_deg', family: 'number', type: 'DOUBLE', desc: 'ekliptische Breite' },
      { name: 'zodiac_sign', family: 'text', minLen: 11, type: 'VARCHAR(16)', desc: "Tierkreiszeichen, z. B. 'Sagittarius'" },
      { name: 'degree_in_sign', family: 'number', type: 'DOUBLE', desc: 'Grad im Tierkreiszeichen' },
      { name: 'constellation', family: 'text', minLen: 20, type: 'VARCHAR(32)', desc: 'Sternbild' },
      { name: 'vis_magnitude', family: 'number', nullable: true, type: 'DOUBLE', desc: 'Helligkeit' },
      { name: 'phase_fraction', family: 'number', nullable: true, type: 'DOUBLE', desc: 'beleuchteter Anteil, bei der Sonne leer' },
      { name: 'retrograde', family: 'int', type: 'TINYINT(1)', desc: '1 = rückläufig' },
      { name: 'helio_lon_deg', family: 'number', nullable: true, type: 'DOUBLE', desc: 'Länge von der Sonne aus, bei der Sonne leer' },
      { name: 'helio_dist_au', family: 'number', nullable: true, type: 'DOUBLE', desc: 'Abstand von der Sonne, bei der Sonne leer' },
    ],
    primaryKey: ['event_id', 'body'],
    unique: [],
    foreignKeys: [{ column: 'event_id', table: 'events' }],
    recommendedIndexes: [['body', 'zodiac_sign']],
  },
  aspects: {
    purpose: 'Winkelbeziehungen (Aspekte) zwischen zwei Körpern bei jedem Event.',
    columns: [
      { name: 'event_id', family: 'int', type: 'INT UNSIGNED', desc: 'zu welchem Event (id aus events)' },
      { name: 'body_a', family: 'text', minLen: 7, type: 'VARCHAR(16)', desc: 'erster Körper' },
      { name: 'body_b', family: 'text', minLen: 7, type: 'VARCHAR(16)', desc: 'zweiter Körper' },
      { name: 'aspect', family: 'text', minLen: 11, type: 'VARCHAR(16)', desc: "z. B. 'conjunction', 'opposition'" },
      { name: 'separation_deg', family: 'number', type: 'DOUBLE', desc: 'Winkel zwischen den beiden' },
      { name: 'orb_deg', family: 'number', type: 'DOUBLE', desc: 'Abweichung vom exakten Aspekt' },
    ],
    primaryKey: ['event_id', 'body_a', 'body_b', 'aspect'],
    unique: [],
    foreignKeys: [{ column: 'event_id', table: 'events' }],
    recommendedIndexes: [['body_a', 'body_b', 'aspect']],
  },
};

const FAMILY = {
  int: ['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'],
  number: ['double', 'float', 'decimal', 'real', 'tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'],
  text: ['varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum'],
  datetime: ['datetime', 'timestamp'],
};
const FAMILY_NAME = { int: 'eine Ganzzahl (z. B. INT)', number: 'eine Zahl (DOUBLE)', text: 'Text (VARCHAR)', datetime: 'ein Zeitpunkt (DATETIME)' };

const sameCols = (a, b) => a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());
const list = (cols) => cols.join(', ');

/**
 * Prüft gelesene Tabellen gegen SPEC. structure = { <basisname>: null (fehlt) oder
 *   { name, columns: [{ name, dataType, columnType, nullable, def, extra, maxLen }], primaryKey: [..],
 *     uniques: [[..]], indexes: [[..]], foreignKeys: [{ column, refTable }] } }
 * Gibt { ok, errors: [{ table, text, fix? }], hints: [{ table, text, fix? }] } zurück.
 */
function checkStructure(structure, prefix = '') {
  const errors = [];
  const hints = [];
  for (const [base, spec] of Object.entries(SPEC)) {
    const table = prefix + base;
    const t = structure[base];
    if (!t) {
      errors.push({ table, text: `Die Tabelle ${table} fehlt.` });
      continue;
    }
    const cols = new Map(t.columns.map((c) => [c.name.toLowerCase(), c]));
    for (const want of spec.columns) {
      const c = cols.get(want.name);
      if (!c) {
        errors.push({ table, text: `Spalte ${want.name} fehlt (${want.desc}).`, fix: `ALTER TABLE ${table} ADD COLUMN ${want.name} ${want.type}${want.nullable ? ' NULL' : ''};` });
        continue;
      }
      const dt = c.dataType.toLowerCase();
      if (!FAMILY[want.family].includes(dt)) {
        errors.push({ table, text: `Spalte ${want.name} ist ${c.columnType}, muss aber ${FAMILY_NAME[want.family]} sein.`, fix: `ALTER TABLE ${table} MODIFY ${want.name} ${want.type}${want.nullable ? ' NULL' : ''};` });
        continue;
      }
      if (want.values && dt === 'enum') {
        const missingValues = want.values.filter((v) => !c.columnType.includes(`'${v}'`));
        if (missingValues.length) errors.push({ table, text: `In ENUM von ${want.name} fehlt ${missingValues.map((v) => `'${v}'`).join(' und ')}.`, fix: `ALTER TABLE ${table} MODIFY ${want.name} ${want.type} NOT NULL;` });
      } else if (want.values && c.maxLen != null && c.maxLen < Math.max(...want.values.map((v) => v.length))) {
        errors.push({ table, text: `In ${want.name} passen nur ${c.maxLen} Zeichen, 'earthquake' braucht 10.`, fix: `ALTER TABLE ${table} MODIFY ${want.name} ${want.type} NOT NULL;` });
      }
      if (want.minLen && c.maxLen != null && c.maxLen < want.minLen) {
        (want.softMinLen ? hints : errors).push({ table, text: `In ${want.name} passen nur ${c.maxLen} Zeichen, nötig sind mindestens ${want.minLen}.`, fix: `ALTER TABLE ${table} MODIFY ${want.name} ${want.type}${want.nullable ? ' NULL' : ' NOT NULL'};` });
      }
      if (want.nullable && !c.nullable) {
        errors.push({ table, text: `Spalte ${want.name} muss leer (NULL) sein dürfen: ${want.desc}.`, fix: `ALTER TABLE ${table} MODIFY ${want.name} ${want.type} NULL;` });
      }
      if (want.autoIncrement && !/auto_increment/i.test(c.extra || '')) {
        errors.push({ table, text: `Spalte ${want.name} braucht AUTO_INCREMENT, sonst bekommt jede Zeile dieselbe Nummer.`, fix: `ALTER TABLE ${table} MODIFY ${want.name} INT UNSIGNED NOT NULL AUTO_INCREMENT;` });
      }
      if (want.default0 && String(c.def ?? '').replace(/'/g, '') !== '0') {
        errors.push({ table, text: `Spalte ${want.name} braucht DEFAULT 0. Node-RED trägt beim Einfügen nichts ein und sucht dann nach 0.`, fix: `ALTER TABLE ${table} MODIFY ${want.name} TINYINT(1) NOT NULL DEFAULT 0;` });
      }
      if (want.family === 'number' && dt === 'float') {
        hints.push({ table, text: `${want.name} ist FLOAT: geht, ist aber ungenauer als DOUBLE.` });
      }
      if (want.name === 'time_utc' && dt === 'datetime' && !/\(3\)/.test(c.columnType)) {
        hints.push({ table, text: 'time_utc speichert keine Millisekunden. Geht, DATETIME(3) wäre genauer.' });
      }
    }
    // zusätzliche Spalten dürfen nicht im Weg sein: Node-RED füllt sie nicht
    const known = new Set(spec.columns.map((c) => c.name));
    for (const c of t.columns) {
      if (!known.has(c.name.toLowerCase()) && !c.nullable && c.def == null && !/auto_increment|default_generated/i.test(c.extra || '')) {
        errors.push({ table, text: `Zusätzliche Spalte ${c.name} ist NOT NULL ohne DEFAULT. Node-RED füllt sie nicht, deshalb schlägt jedes Einfügen fehl.`, fix: `ALTER TABLE ${table} MODIFY ${c.name} ${c.columnType} NULL;` });
      }
    }
    // Schlüssel
    if (!sameCols(t.primaryKey || [], spec.primaryKey)) {
      errors.push({
        table,
        text: t.primaryKey && t.primaryKey.length
          ? `Primärschlüssel ist (${list(t.primaryKey)}), muss aber (${list(spec.primaryKey)}) sein.`
          : `Es fehlt der Primärschlüssel (${list(spec.primaryKey)}).${spec.primaryKey.length > 1 ? ' Ohne ihn speichert Node-RED jede Position bei jeder Neuberechnung noch einmal.' : ''}`,
        fix: `ALTER TABLE ${table} ${t.primaryKey && t.primaryKey.length ? 'DROP PRIMARY KEY, ' : ''}ADD PRIMARY KEY (${list(spec.primaryKey)});`,
      });
    }
    for (const u of spec.unique) {
      const has = (t.uniques || []).some((x) => sameCols(x, u)) || sameCols(t.primaryKey || [], u);
      if (!has) {
        errors.push({ table, text: `${list(u)} braucht einen UNIQUE-Schlüssel. Sonst speichert Node-RED dasselbe Beben alle 5 Minuten noch einmal.`, fix: `ALTER TABLE ${table} ADD UNIQUE (${list(u)});` });
      }
    }
    for (const fk of spec.foreignKeys) {
      const has = (t.foreignKeys || []).some((f) => f.column.toLowerCase() === fk.column && f.refTable.toLowerCase() === prefix + fk.table);
      if (!has) {
        hints.push({ table, text: `Kein Fremdschlüssel ${fk.column} → ${prefix}${fk.table}(id). Geht ohne, aber dann prüft die Datenbank nicht, ob es das Event gibt.`, fix: `ALTER TABLE ${table} ADD FOREIGN KEY (${fk.column}) REFERENCES ${prefix}${fk.table}(id) ON DELETE CASCADE;` });
      }
    }
    for (const idx of spec.recommendedIndexes) {
      const all = [...(t.indexes || []), ...(t.uniques || []), t.primaryKey || []];
      if (!all.some((x) => x.length >= idx.length && sameCols(x.slice(0, idx.length), idx))) {
        hints.push({ table, text: `Ein Index auf (${list(idx)}) würde die Grafana-Abfragen schneller machen.`, fix: `ALTER TABLE ${table} ADD INDEX (${list(idx)});` });
      }
    }
  }
  return { ok: errors.length === 0, errors, hints };
}

module.exports = { SPEC, checkStructure, FAMILY };
