// Einheit 05 – Musterlösung

const ZODIAC = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
const ASPECTS = [
  { name: 'conjunction', angle: 0 },
  { name: 'sextile', angle: 60 },
  { name: 'square', angle: 90 },
  { name: 'trine', angle: 120 },
  { name: 'opposition', angle: 180 },
];

function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

function zodiacOf(elon) {
  const lon = norm360(elon);
  const idx = Math.floor(lon / 30);
  return { sign: ZODIAC[idx], degreeInSign: Number((lon - idx * 30).toFixed(1)) };
}

function separation(a, b) {
  const sep = Math.abs(norm360(a) - norm360(b));
  return sep > 180 ? 360 - sep : sep;
}

function aspectsFor(sep, orb) {
  return ASPECTS.filter((a) => Math.abs(sep - a.angle) <= orb).map((a) => a.name);
}

function isRetrograde(before, after) {
  const delta = ((after - before + 540) % 360) - 180;
  return delta < 0;
}

function moonPhase(sunLon, moonLon) {
  return norm360(moonLon - sunLon);
}

module.exports = { ZODIAC, ASPECTS, norm360, zodiacOf, separation, aspectsFor, isRetrograde, moonPhase };
