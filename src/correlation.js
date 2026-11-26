// Correlation finder: is a sky position more common at earthquakes than at control events?
//
// Every quake has a control event: same place, random time. If the sky had no influence, a sky
// position (e.g. "Moon 30-60° from the Sun") would be just as common at quakes as at controls.
// This module compares the two, bin by bin, and guards against the usual traps:
//   - aftershocks:     one big quake brings many more within days, all with the same sky -> decluster()
//   - many attempts:   test 100 bins and ~5 look "significant" by chance -> Bonferroni (pAdjusted)
//   - one-off flukes:  an effect found in one period should come back in another -> replicate()
//   - unfair baseline: the stored control events lie in the 2 years BEFORE each quake. That is a fair
//                      comparison only for things that repeat many times in that time (Moon: 29.5 days).
//                      Saturn needs 29 years for one orbit: quakes and controls would simply see Saturn in
//                      different years. -> cycleDays() / fair
// No database code here: tools/korrelation.js reads the data, the Grafana panel uses the same rules in SQL.

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

/** Angle between two ecliptic longitudes, 0..180°. */
const separation = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/**
 * What can be compared. kind 'angle' = bins of `step` degrees within `range`;
 * kind 'quantile' = 5 groups from nearest to farthest (edges from the control events).
 * value(row, body) -> number or null (null = not available, e.g. not computed yet).
 */
const METRICS = {
  'moon-phase': {
    label: 'Moon phase (angle Sun–Earth–Moon: 0 = new, 180 = full)', kind: 'angle', range: [0, 360], perBody: false,
    value: (r) => r.moonPhase,
  },
  altitude: {
    label: 'Height above the horizon at the quake location (−90 = straight below)', kind: 'angle', range: [-90, 90], perBody: true,
    value: (r, b) => r.bodies[b]?.alt ?? null,
  },
  'sun-angle': {
    label: 'Angle to the Sun, seen from the Earth (0 = next to the Sun)', kind: 'angle', range: [0, 180], perBody: true,
    skip: ['Sun'],
    value: (r, b) => (r.bodies[b] && r.bodies.Sun ? separation(r.bodies[b].eclLon, r.bodies.Sun.eclLon) : null),
  },
  'dist-earth': {
    label: 'Distance from the Earth', kind: 'quantile', perBody: true,
    value: (r, b) => r.bodies[b]?.dist ?? null,
  },
  'dist-sun': {
    label: 'Distance from the Sun (Sun: the Earth\'s distance)', kind: 'quantile', perBody: true, skip: ['Moon'],
    value: (r, b) => (b === 'Sun' ? r.bodies.Sun?.dist ?? null : r.bodies[b]?.helioDist ?? null),
  },
};

/** Controls: random time within this many days before the quake (node-red/functions/split-usgs.js). */
const CONTROL_WINDOW_DAYS = 730;
/** A comparison is fair if the quakes' period and the control window each cover this many cycles. */
const MIN_CYCLES = 4;

const ORBIT_DAYS = { Sun: 365.25, Moon: 27.32, Mercury: 87.97, Venus: 224.7, Mars: 686.98, Jupiter: 4332.6, Saturn: 10759, Uranus: 30687, Neptune: 60190, Pluto: 90560 };
// synodic period: how often the body comes back to the same place relative to the Sun, seen from Earth
const SYNODIC_DAYS = { Moon: 29.53, Mercury: 115.88, Venus: 583.92, Mars: 779.94, Jupiter: 398.88, Saturn: 378.09, Uranus: 369.66, Neptune: 367.49, Pluto: 366.73 };

/**
 * After how many days a metric repeats for a body. Height above the horizon repeats daily, but how high
 * a body climbs follows its declination: yearly for the Sun, Mercury and Venus, slower for outer planets.
 */
function cycleDays(metric, body) {
  switch (metric) {
    case 'moon-phase': return SYNODIC_DAYS.Moon;
    case 'altitude': return ['Sun', 'Mercury', 'Venus'].includes(body) ? 365.25 : ORBIT_DAYS[body];
    case 'sun-angle': return SYNODIC_DAYS[body];
    case 'dist-earth': return body === 'Sun' ? 365.25 : body === 'Moon' ? 27.55 : SYNODIC_DAYS[body];
    case 'dist-sun': return ORBIT_DAYS[body];
    default: return Infinity;
  }
}

// ---------------------------------------------------------------------------- statistics helpers

function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941678, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310007 * ser / x);
}

/** Upper regularized incomplete gamma Q(a, x). */
function gammaQ(a, x) {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let sum = 1 / a;
    let del = sum;
    let ap = a;
    for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
    return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a)));
  }
  let b = x + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

/** p-value of a χ² statistic with df degrees of freedom. */
const chiSquareP = (chi, df) => (df > 0 ? gammaQ(df / 2, chi / 2) : 1);

/** Two-sided p-value of a z score (normal distribution). */
function normalP(z) {
  // erfc approximation (Abramowitz & Stegun 7.1.26), accurate to ~1e-7
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return Math.min(1, erfc);
}

// ---------------------------------------------------------------------------- data preparation

/** Great-circle distance in km. */
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Keeps only main shocks: a quake drops out if there is a stronger one (or an equally strong, earlier
 * one) within `days` and `km`. Aftershocks and foreshocks of a sequence go, the main shock stays.
 * The Grafana panel uses the same rule in SQL (grafana/queries.sql, query 13).
 */
function decluster(quakes, { days = 3, km = 300 } = {}) {
  const ms = days * 24 * 3600 * 1000;
  const stronger = (s, q) => s.mag > q.mag || (s.mag === q.mag && s.time < q.time);
  return quakes.filter((q) => !quakes.some((s) => s !== q && stronger(s, q)
    && Math.abs(s.time - q.time) <= ms && distanceKm(s, q) <= km));
}

/**
 * Quakes and their controls for one analysis. rows: all events (kind 'earthquake' or 'control').
 * Quakes are filtered by magnitude and time; a control is used if its quake is used.
 */
function selectEvents(rows, { minMag = 0, from = null, to = null, declustered = true, days, km } = {}) {
  let quakes = rows.filter((r) => r.kind === 'earthquake' && r.mag >= minMag
    && (!from || r.time >= from) && (!to || r.time < to));
  if (declustered) quakes = decluster(quakes, { days, km });
  const used = new Set(quakes.map((q) => q.sourceId));
  const controls = rows.filter((r) => r.kind === 'control' && used.has(r.pairedWith));
  return { quakes, controls };
}

// ---------------------------------------------------------------------------- comparison

function binsFor(metric, step, controlValues) {
  const m = METRICS[metric];
  if (m.kind === 'angle') {
    const [lo, hi] = m.range;
    const edges = [];
    for (let e = lo; e < hi; e += step) edges.push(e);
    edges.push(hi);
    return edges.map((e, i) => (i < edges.length - 1 ? { lo: e, hi: edges[i + 1], label: `${e}…${edges[i + 1]}°` } : null)).filter(Boolean);
  }
  const s = [...controlValues].sort((a, b) => a - b);
  const q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  const names = ['nearest 20 %', '20–40 %', '40–60 %', '60–80 %', 'farthest 20 %'];
  return names.map((label, i) => ({ lo: i === 0 ? -Infinity : q(i / 5), hi: i === 4 ? Infinity : q((i + 1) / 5), label }));
}

/** Index of the bin with lo <= v < hi (the last bin also includes its upper edge), -1 if outside. */
const binOf = (bins, v) => bins.findIndex((b, i) => v >= b.lo && (v < b.hi || (i === bins.length - 1 && v <= b.hi)));

/**
 * Compares one metric for one body. Returns per bin: quake and control share, difference in %
 * ("+20 %" = 20 % more quakes than chance), z score and p-value (two-proportion test), and the
 * p-value after Bonferroni (times the number of bins); for the whole table a χ² test (2 × k).
 */
function compare(rows, { metric, body = 'Moon', step = 30, ...select } = {}) {
  const m = METRICS[metric];
  if (!m) throw new Error(`Unknown metric "${metric}". Choose: ${Object.keys(METRICS).join(', ')}`);
  const { quakes, controls } = selectEvents(rows, select);
  const vals = (list) => list.map((r) => m.value(r, body)).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  const qv = vals(quakes);
  const cv = vals(controls);
  const bins = binsFor(metric, step, cv);
  const qc = bins.map(() => 0);
  const cc = bins.map(() => 0);
  for (const v of qv) { const i = binOf(bins, v); if (i >= 0) qc[i]++; }
  for (const v of cv) { const i = binOf(bins, v); if (i >= 0) cc[i]++; }
  const Q = qc.reduce((a, b) => a + b, 0);
  const C = cc.reduce((a, b) => a + b, 0);

  let chi = 0;
  let df = -1;
  const rowsOut = bins.map((b, i) => {
    const qShare = Q ? qc[i] / Q : 0;
    const cShare = C ? cc[i] / C : 0;
    const pooled = (qc[i] + cc[i]) / (Q + C || 1);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / (Q || 1) + 1 / (C || 1)));
    const z = se > 0 ? (qShare - cShare) / se : 0;
    const p = normalP(z);
    if (qc[i] + cc[i] > 0) {
      df++;
      const eq = (qc[i] + cc[i]) * Q / (Q + C);
      const ec = (qc[i] + cc[i]) * C / (Q + C);
      chi += (qc[i] - eq) ** 2 / eq + (cc[i] - ec) ** 2 / ec;
    }
    return {
      bin: b.label, lo: b.lo, hi: b.hi, quakes: qc[i], controls: cc[i],
      quakePct: 100 * qShare, controlPct: 100 * cShare,
      diffPct: cShare > 0 ? 100 * (qShare / cShare - 1) : null,
      z, p, pAdjusted: Math.min(1, p * bins.length),
    };
  });
  const times = quakes.map((q) => q.time);
  const spanDays = times.length ? (Math.max(...times) - Math.min(...times)) / (24 * 3600 * 1000) : 0;
  const cycle = cycleDays(metric, body);
  return {
    metric, body: m.perBody ? body : null, label: m.label, step: m.kind === 'angle' ? step : null,
    cycleDays: cycle, spanDays, fair: Math.min(spanDays, CONTROL_WINDOW_DAYS) >= MIN_CYCLES * cycle,
    quakes: Q, controls: C, skipped: quakes.length - qv.length,
    bins: rowsOut, chi, df: Math.max(0, df), p: chiSquareP(chi, Math.max(0, df)),
  };
}

/** The bin with the largest effect (smallest p), or null. */
const strongest = (result) => result.bins.reduce((best, b) => (b.quakes + b.controls > 0 && (!best || b.p < best.p) ? b : best), null);

/**
 * Finds an effect in one period and checks it in another: same bin, same direction, p < 0.05 there.
 * periods: [{from, to, name}, {from, to, name}]
 */
function replicate(rows, opts, [first, second]) {
  const found = compare(rows, { ...opts, from: first.from, to: first.to });
  const best = strongest(found);
  const check = compare(rows, { ...opts, from: second.from, to: second.to });
  const again = best && check.bins.find((b) => b.bin === best.bin);
  const confirmed = Boolean(best && again && check.fair && again.p < 0.05 && Math.sign(again.z) === Math.sign(best.z) && best.z !== 0);
  return { found, best, check, again, confirmed };
}

/** Every combination that makes sense: each metric (per body where it depends on the body). */
function combinations() {
  const out = [];
  for (const [metric, m] of Object.entries(METRICS)) {
    for (const body of m.perBody ? BODIES.filter((b) => !(m.skip || []).includes(b)) : ['Moon']) out.push({ metric, body });
  }
  return out;
}

/**
 * Tries every fair combination, ranks them by p-value and corrects for the number of tests (Bonferroni
 * over all tested bins). With 'replicate' periods each hit is also checked in the second period.
 * Combinations whose cycle is too long for the data (see cycleDays) are listed in `unfair`, not tested.
 */
function scan(rows, { step = 30, periods = null, ...select } = {}) {
  const unfair = [];
  const results = combinations().filter(({ metric, body }) => {
    const r = compare(rows, { metric, body, step, ...select, ...(periods ? { from: periods[0].from, to: periods[0].to } : {}) });
    if (!r.fair) unfair.push({ metric, body, cycleDays: r.cycleDays, spanDays: r.spanDays });
    return r.fair;
  }).map(({ metric, body }) => {
    const opts = { metric, body, step, ...select };
    if (!periods) {
      const r = compare(rows, opts);
      return { metric, body, result: r, best: strongest(r) };
    }
    const rep = replicate(rows, opts, periods);
    return { metric, body, result: rep.found, best: rep.best, check: rep.again, confirmed: rep.confirmed };
  });
  const tests = results.reduce((n, r) => n + r.result.bins.length, 0);
  for (const r of results) r.pAll = r.best ? Math.min(1, r.best.p * tests) : 1;
  results.sort((a, b) => (a.best?.p ?? 1) - (b.best?.p ?? 1));
  return { tests, results, unfair };
}

module.exports = {
  METRICS, BODIES, separation, distanceKm, decluster, selectEvents, binsFor, compare, strongest, replicate, scan,
  combinations, cycleDays, chiSquareP, normalP, CONTROL_WINDOW_DAYS, MIN_CYCLES,
};
