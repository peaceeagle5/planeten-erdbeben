// Einheit 11 – χ²-Test der Mondphase mit deinen echten Daten.
// Benutzt DEINE Funktionen aus uebung.js (mit LOESUNG=1 die Musterlösung).
// Start: node lernen/11-statistik/analyse.js             alle Beben
//        node lernen/11-statistik/analyse.js 6           nur ab Magnitude 6
//        node lernen/11-statistik/analyse.js --pro-tag   nur das stärkste Beben pro Tag (gegen Nachbeben-Häufungen)
const mysql = require('mysql2/promise');
const { dbConfig } = require('../verbindung');
const s = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

const NAMES = ['Neumond', 'zun. Sichel', '1. Viertel', 'zun. Mond', 'Vollmond', 'abn. Mond', '3. Viertel', 'abn. Sichel'];

async function main() {
  const perDay = process.argv.includes('--pro-tag');
  const minMag = Number(process.argv.slice(2).find((a) => !a.startsWith('--')) || 0);
  const conn = await mysql.createConnection(dbConfig());
  const [rows] = await conn.query(
    'SELECT kind, source_id, paired_with, DATE_FORMAT(time_utc, "%Y-%m-%d") AS day, magnitude, moon_phase_deg ' +
    'FROM events WHERE sky_computed = 1 AND magnitude >= ?', [minMag]);
  await conn.end();

  let used = rows;
  if (perDay) {
    // pro Tag nur das stärkste Beben behalten, und nur die Kontroll-Events dieser Beben
    const strongest = {};
    for (const r of rows.filter((x) => x.kind === 'earthquake')) {
      if (!strongest[r.day] || r.magnitude > strongest[r.day].magnitude) strongest[r.day] = r;
    }
    const keep = new Set(Object.values(strongest).map((r) => r.source_id));
    used = rows.filter((r) => (r.kind === 'earthquake' ? keep.has(r.source_id) : keep.has(r.paired_with)));
  }

  const groupsOf = (kind) => used.filter((r) => r.kind === kind).map((r) => NAMES[s.phaseGroup(r.moon_phase_deg)]);
  const quakes = groupsOf('earthquake');
  const observed = s.countBy(quakes);
  const expected = s.expectedCounts(s.countBy(groupsOf('control')), quakes.length);

  console.log(`\nMondphase bei ${quakes.length} Erdbeben (M ≥ ${minMag}${perDay ? ', nur das stärkste pro Tag' : ''}) gegen Kontroll-Events\n`);
  console.log('Phase          beobachtet   erwartet   Abweichung');
  for (const name of NAMES) {
    const o = observed[name] ?? 0;
    const e = expected[name] ?? 0;
    console.log(`${name.padEnd(14)} ${String(o).padStart(10)} ${e.toFixed(1).padStart(10)} ${((o - e) / e * 100).toFixed(1).padStart(10)} %`);
  }
  const chi = s.chiSquare(observed, expected);
  const groups = Object.keys(expected).length;
  console.log(`\nχ² = ${chi.toFixed(2)} bei ${groups - 1} Freiheitsgraden (kritisch: ${s.CRITICAL[groups - 1]})`);
  console.log(s.isSignificant(chi, groups)
    ? '→ Auffällig (bei 5 %). Bevor du es glaubst: Nachbeben? Wiederholt es sich mit einem anderen Jahr?'
    : '→ Nicht auffällig: Der Unterschied ist mit Zufall erklärbar.');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
