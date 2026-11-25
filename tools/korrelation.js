// Korrelations-Finder: Gibt es bei Erdbeben eine Himmelsstellung häufiger als bei den Kontroll-Events?
// Die Rechnung steht in src/correlation.js; dieses Skript liest die Daten und zeigt das Ergebnis.
//
//   npm run korrelation                                   Mondphase, 30°-Schritte, alle Beben
//   npm run korrelation -- --metrik sun-angle --koerper Moon --schritt 30 --minmag 5
//   npm run korrelation -- --metrik altitude --koerper Jupiter
//   npm run korrelation -- --metrik dist-earth --koerper Moon       (nah … fern, 5 Gruppen)
//   npm run korrelation -- --suche --minmag 5             alles durchprobieren, beste Treffer
//   Optionen: --mit-nachbeben (nicht entclustern), --praefix anna_ (eigene Tabellen)
//
// Datenbank-Zugang wie bei den Lerneinheiten: .env im Projektordner (DB_HOST, DB_PORT, DB_USER, ...).
const mysql = require('mysql2/promise');
const { dbConfig } = require('../lernen/verbindung');
const { normalizePrefix, tableNames } = require('../shared/tables');
const c = require('../src/correlation');

const NAMEN = {
  'moon-phase': 'Mondphase (Winkel Sonne–Erde–Mond: 0° Neumond, 180° Vollmond)',
  altitude: 'Höhe über dem Horizont am Bebenort (−90° = genau darunter)',
  'sun-angle': 'Winkel zur Sonne, von der Erde aus gesehen (0° = neben der Sonne)',
  'dist-earth': 'Abstand von der Erde',
  'dist-sun': 'Abstand von der Sonne (bei „Sun“: Abstand der Erde)',
};
const BEREICH = { 'nearest 20 %': 'nächste 20 %', 'farthest 20 %': 'fernste 20 %' };

function args(argv) {
  const o = { metrik: 'moon-phase', koerper: 'Moon', schritt: 30, minmag: 0, praefix: '', suche: false, nachbeben: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--suche') o.suche = true;
    else if (a === '--mit-nachbeben') o.nachbeben = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  }
  o.schritt = Number(o.schritt);
  o.minmag = Number(o.minmag);
  if (!c.METRICS[o.metrik]) throw new Error(`Unbekannte Metrik "${o.metrik}". Möglich: ${Object.keys(c.METRICS).join(', ')}`);
  if (!c.BODIES.includes(o.koerper)) throw new Error(`Unbekannter Körper "${o.koerper}". Möglich: ${c.BODIES.join(', ')}`);
  if (!(o.schritt > 0 && o.schritt <= 180)) throw new Error('--schritt muss zwischen 1 und 180 liegen.');
  return o;
}

/** Alle Events mit den Positionen aller Körper (eine Zeile pro Event). */
async function laden(prefix) {
  const t = tableNames(prefix);
  const conn = await mysql.createConnection({ ...dbConfig(), timezone: 'Z' });
  try {
    const [events] = await conn.query(
      `SELECT id, kind, source_id, paired_with, time_utc, latitude, longitude, magnitude, moon_phase_deg FROM \`${t.events}\` WHERE sky_computed = 1`);
    const [pos] = await conn.query(
      `SELECT event_id, body, altitude_deg, ecl_lon_deg, distance_au, helio_dist_au FROM \`${t.body_positions}\``)
      .catch(async (err) => {
        if (err.code !== 'ER_BAD_FIELD_ERROR') throw err; // alte Tabellen ohne helio_dist_au
        return conn.query(`SELECT event_id, body, altitude_deg, ecl_lon_deg, distance_au, NULL AS helio_dist_au FROM \`${t.body_positions}\``);
      });
    const bodies = new Map();
    for (const p of pos) {
      if (!bodies.has(p.event_id)) bodies.set(p.event_id, {});
      bodies.get(p.event_id)[p.body] = { alt: p.altitude_deg, eclLon: p.ecl_lon_deg, dist: p.distance_au, helioDist: p.helio_dist_au };
    }
    return events.map((e) => ({
      kind: e.kind, sourceId: e.source_id, pairedWith: e.paired_with, time: e.time_utc.getTime(),
      lat: e.latitude, lon: e.longitude, mag: e.magnitude, moonPhase: e.moon_phase_deg, bodies: bodies.get(e.id) || {},
    }));
  } finally {
    await conn.end();
  }
}

const komma = (v, digits) => v.toFixed(digits).replace('.', ',');
const pct = (v) => (v === null ? '–' : `${v >= 0 ? '+' : ''}${v.toFixed(0)} %`);
const pWert = (p) => (p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ','));
const datum = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Zeitraum in zwei Hälften mit gleich vielen Beben: in der ersten finden, in der zweiten prüfen. */
function haelften(rows, o) {
  const { quakes } = c.selectEvents(rows, { minMag: o.minmag, declustered: !o.nachbeben });
  const times = quakes.map((q) => q.time).sort((a, b) => a - b);
  if (times.length < 20) return null;
  const mid = times[Math.floor(times.length / 2)];
  return [{ from: times[0], to: mid, name: `${datum(times[0])} bis ${datum(mid - 1)}` },
    { from: mid, to: times[times.length - 1] + 1, name: `${datum(mid)} bis ${datum(times[times.length - 1])}` }];
}

function einzeln(rows, o) {
  const opts = { metric: o.metrik, body: o.koerper, step: o.schritt, minMag: o.minmag, declustered: !o.nachbeben };
  const r = c.compare(rows, opts);
  const alle = c.compare(rows, { ...opts, declustered: false });
  console.log(`\n${NAMEN[o.metrik]}${r.body ? ` · ${r.body}` : ''} · M ≥ ${o.minmag}`);
  console.log(o.nachbeben
    ? `${r.quakes} Beben (mit Nachbeben) gegen ${r.controls} Kontroll-Events`
    : `${r.quakes} Hauptbeben (von ${alle.quakes}; Nachbeben: gleiche Gegend ≤ 300 km, ≤ 3 Tage) gegen ${r.controls} Kontroll-Events`);
  if (r.skipped) console.log(`(${r.skipped} Beben ohne Wert, z. B. noch nicht neu berechnet)`);
  if (!r.fair) {
    console.log(`\n⚠ Nicht aussagekräftig: Das wiederholt sich erst nach ${Math.round(r.cycleDays)} Tagen. Die Beben umfassen ${Math.round(r.spanDays)} Tage,` +
      `\n  die Kontroll-Events liegen in den ${c.CONTROL_WINDOW_DAYS} Tagen davor. Für einen fairen Vergleich müssten beide mindestens` +
      `\n  ${c.MIN_CYCLES} Durchläufe (${Math.round(c.MIN_CYCLES * r.cycleDays)} Tage) abdecken. Sonst vergleicht man nur verschiedene Jahre.`);
  }
  console.log('\nBereich           Beben  Kontrolle  Unterschied        p   p korrigiert');
  for (const b of r.bins) {
    const mark = b.pAdjusted < 0.05 ? '  ◀ auffällig' : '';
    console.log(`${(BEREICH[b.bin] || b.bin).padEnd(16)} ${komma(b.quakePct, 1).padStart(5)} % ${komma(b.controlPct, 1).padStart(7)} % ${pct(b.diffPct).padStart(11)} ${pWert(b.p).padStart(9)} ${pWert(b.pAdjusted).padStart(13)}${mark}`);
  }
  console.log(`\nGesamt: χ² = ${komma(r.chi, 1)} bei ${r.df} Freiheitsgraden, p = ${pWert(r.p)}` +
    (r.p < 0.05 ? ' → die Verteilung weicht vom Zufall ab.' : ' → mit Zufall erklärbar.'));
  console.log('„p korrigiert“ = p × Anzahl der Bereiche: Wer viele Bereiche ansieht, findet sonst immer etwas.');

  const periods = haelften(rows, o);
  if (!periods) return;
  const rep = c.replicate(rows, opts, periods);
  if (!rep.best) return;
  if (!rep.found.fair || !rep.check.fair) {
    console.log(`\nGegenprobe (Hälften ${periods[0].name} / ${periods[1].name}): nicht möglich, die Hälften sind für diesen Zyklus zu kurz.`);
    return;
  }
  console.log(`\nGegenprobe: In ${periods[0].name} ist ${BEREICH[rep.best.bin] || rep.best.bin} am stärksten (${pct(rep.best.diffPct)}, p = ${pWert(rep.best.p)}).`);
  console.log(`            In ${periods[1].name}: ${pct(rep.again.diffPct)}, p = ${pWert(rep.again.p)} → ` +
    (rep.confirmed ? 'bestätigt. Interessant, aber noch kein Beweis.' : 'nicht bestätigt, wahrscheinlich Zufall.'));
}

function suche(rows, o) {
  const periods = haelften(rows, o);
  const s = c.scan(rows, { step: o.schritt, minMag: o.minmag, declustered: !o.nachbeben, periods });
  console.log(`\nSuche über alle Metriken und Körper (M ≥ ${o.minmag}, ${o.nachbeben ? 'mit' : 'ohne'} Nachbeben, ${o.schritt}°-Schritte)`);
  if (periods) console.log(`Gefunden in ${periods[0].name}, geprüft in ${periods[1].name}.`);
  console.log(`${s.tests} Bereiche getestet: Bei 5 % Irrtum wären etwa ${Math.round(s.tests * 0.05)} „Treffer“ reiner Zufall.`);
  if (s.unfair.length) {
    console.log(`Nicht getestet (${s.unfair.length} Kombinationen): Ihr Zyklus ist für die Daten zu lang, z. B. ` +
      s.unfair.slice(0, 4).map((u) => `${u.metric}/${u.body} ${Math.round(u.cycleDays)} Tage`).join(', ') + '.');
    console.log('Dafür bräuchte man Beben und Kontrollen über viele Jahre.');
  }
  console.log('');
  console.log('Metrik       Körper   Bereich         Unterschied        p   p (alle Tests)   Gegenprobe');
  for (const r of s.results.slice(0, 12)) {
    if (!r.best) continue;
    const check = !periods ? '' : r.confirmed ? `bestätigt (${pct(r.check.diffPct)})` : `nein (${pct(r.check?.diffPct ?? null)})`;
    console.log(`${r.metric.padEnd(12)} ${(c.METRICS[r.metric].perBody ? r.body : '–').padEnd(8)} ${(BEREICH[r.best.bin] || r.best.bin).padEnd(15)} ${pct(r.best.diffPct).padStart(11)} ${pWert(r.best.p).padStart(9)} ${pWert(r.pAll).padStart(16)}   ${check}`);
  }
  const echt = s.results.filter((r) => r.pAll < 0.05 && (!periods || r.confirmed));
  console.log(echt.length
    ? `\n${echt.length} Treffer halten der Korrektur und der Gegenprobe stand. Genauer ansehen: npm run korrelation -- --metrik ${echt[0].metric} --koerper ${echt[0].body}`
    : '\nKein Treffer hält der Korrektur für viele Tests und der Gegenprobe stand: alles mit Zufall erklärbar.');
}

async function main() {
  const o = args(process.argv.slice(2));
  const rows = await laden(normalizePrefix(o.praefix));
  if (!rows.some((r) => r.kind === 'earthquake')) throw new Error('Keine berechneten Erdbeben in der Datenbank.');
  if (o.suche) suche(rows, o); else einzeln(rows, o);
}

if (require.main === module) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { args };
