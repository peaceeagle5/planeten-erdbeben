// Einheit 11 – Musterlösung

function countBy(values) {
  return values.reduce((counts, v) => {
    counts[v] = (counts[v] ?? 0) + 1;
    return counts;
  }, {});
}

function expectedCounts(controlCounts, total) {
  const controlTotal = Object.values(controlCounts).reduce((a, b) => a + b, 0);
  const out = {};
  for (const [group, n] of Object.entries(controlCounts)) out[group] = (n / controlTotal) * total;
  return out;
}

function chiSquare(observed, expected) {
  let chi = 0;
  for (const [group, exp] of Object.entries(expected)) {
    const obs = observed[group] ?? 0;
    chi += (obs - exp) ** 2 / exp;
  }
  return chi;
}

const CRITICAL = { 1: 3.84, 2: 5.99, 3: 7.81, 4: 9.49, 7: 14.07, 11: 19.68 };
function isSignificant(chi, groups) {
  const critical = CRITICAL[groups - 1];
  if (critical === undefined) throw new Error(`Kein kritischer Wert für ${groups - 1} Freiheitsgrade`);
  return chi > critical;
}

function expectedFalseAlarms(tests, level = 0.05) {
  return tests * level;
}

function phaseGroup(deg) {
  return Math.floor((((deg + 22.5) % 360) + 360) % 360 / 45);
}

module.exports = { countBy, expectedCounts, chiSquare, CRITICAL, isSignificant, expectedFalseAlarms, phaseGroup };
