// Planetary position calculations, built on astronomy-engine.
const Astronomy = require('astronomy-engine');

const BODIES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
];

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

const round = (x, digits = 4) => Number(x.toFixed(digits));

/** Geocentric ecliptic longitude/latitude (true ecliptic of date), degrees. */
function eclipticOf(body, time) {
  const vec = Astronomy.GeoVector(body, time, true);
  return Astronomy.Ecliptic(vec);
}

/**
 * Heliocentric position (seen from the Sun, true ecliptic of date like eclipticOf), for drawing the
 * solar system from above. null for the Sun itself. The Earth is not in BODIES: seen from the Sun it
 * stands exactly opposite to where we see the Sun (longitude + 180°, same distance).
 */
function heliocentricOf(body, time) {
  if (body === 'Sun') return null;
  const vec = Astronomy.HelioVector(body, time);
  const ecl = Astronomy.Ecliptic(vec);
  return { longitudeDeg: round(ecl.elon, 5), latitudeDeg: round(ecl.elat, 5), distanceAU: round(vec.Length(), 8) };
}

function zodiacOf(elon) {
  const idx = Math.floor(elon / 30);
  return { sign: ZODIAC[idx], degreeInSign: round(elon - idx * 30, 4) };
}

/** True if the body's geocentric ecliptic longitude is decreasing. */
function isRetrograde(body, time) {
  if (body === 'Sun' || body === 'Moon') return false;
  const before = eclipticOf(body, time.AddDays(-0.5)).elon;
  const after = eclipticOf(body, time.AddDays(0.5)).elon;
  const delta = ((after - before + 540) % 360) - 180; // signed, handles 360° wrap
  return delta < 0;
}

function nextEvent(body, observer, direction, time) {
  const t = Astronomy.SearchRiseSet(body, observer, direction, time, 1);
  return t ? t.date.toISOString() : null; // null = no event within 24 h (polar day/night)
}

/**
 * Compute positions of the Sun, Moon and planets for a time and place.
 * @param {Date} date
 * @param {{latitude:number, longitude:number, elevation?:number}} place
 * @param {{orb?:number, riseSet?:boolean}} [options] orb = max deviation (degrees) for aspects,
 *   riseSet = also search next rise/set times (slowest part, default true)
 */
function computeSky(date, place, options = {}) {
  const orb = options.orb ?? 8;
  const riseSet = options.riseSet ?? true;
  const time = Astronomy.MakeTime(date);
  const observer = new Astronomy.Observer(place.latitude, place.longitude, place.elevation ?? 0);

  const bodies = BODIES.map((body) => {
    // Topocentric, equator of date: what the observer actually sees (includes parallax).
    const eqDate = Astronomy.Equator(body, time, observer, true, true);
    // J2000 coordinates, needed for IAU constellation lookup.
    const eqJ2000 = Astronomy.Equator(body, time, observer, false, true);
    const hor = Astronomy.Horizon(time, observer, eqDate.ra, eqDate.dec, 'normal');
    const ecl = eclipticOf(body, time);
    const constellation = Astronomy.Constellation(eqJ2000.ra, eqJ2000.dec);
    const illum = Astronomy.Illumination(body, time);

    return {
      body,
      equatorial: {
        rightAscensionHours: round(eqDate.ra, 6),
        declinationDeg: round(eqDate.dec, 5),
        distanceAU: round(eqDate.dist, 8),
        distanceKm: Math.round(eqDate.dist * Astronomy.KM_PER_AU),
      },
      horizontal: {
        azimuthDeg: round(hor.azimuth, 4), // 0 = north, 90 = east
        altitudeDeg: round(hor.altitude, 4), // includes atmospheric refraction
        aboveHorizon: hor.altitude > 0,
      },
      ecliptic: {
        longitudeDeg: round(ecl.elon, 5),
        latitudeDeg: round(ecl.elat, 5),
        ...zodiacOf(ecl.elon),
      },
      heliocentric: heliocentricOf(body, time),
      constellation: { symbol: constellation.symbol, name: constellation.name },
      magnitude: round(illum.mag, 2),
      phaseFraction: body === 'Sun' ? null : round(illum.phase_fraction, 4),
      retrograde: isRetrograde(body, time),
      nextRise: riseSet ? nextEvent(body, observer, +1, time) : null,
      nextSet: riseSet ? nextEvent(body, observer, -1, time) : null,
    };
  });

  return {
    time: time.date.toISOString(),
    observer: { latitude: place.latitude, longitude: place.longitude, elevation: place.elevation ?? 0 },
    moonPhaseDeg: round(Astronomy.MoonPhase(time), 3), // 0 new, 90 first quarter, 180 full, 270 last quarter
    bodies,
    aspects: computeAspects(bodies, orb),
  };
}

/** Angular relationships between every pair of bodies (by ecliptic longitude). */
function computeAspects(bodies, orb) {
  const result = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      let sep = Math.abs(a.ecliptic.longitudeDeg - b.ecliptic.longitudeDeg);
      if (sep > 180) sep = 360 - sep;
      for (const aspect of ASPECTS) {
        const deviation = Math.abs(sep - aspect.angle);
        if (deviation <= orb) {
          result.push({
            bodies: [a.body, b.body],
            aspect: aspect.name,
            separationDeg: round(sep, 3),
            orbDeg: round(deviation, 3),
          });
        }
      }
    }
  }
  return result.sort((x, y) => x.orbDeg - y.orbDeg);
}

module.exports = { computeSky, BODIES };
