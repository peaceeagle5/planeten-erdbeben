// Input: msg.event = {id, latitude, longitude, time_iso}.
// Computes the sky with computeSky() (src/planets.js, inserted above this code when the
// flow is built; "Astronomy" comes from the astronomy-engine module in the Setup tab)
// and outputs SQL messages for body_positions, aspects and marking the event as done.
// REPLACE keeps it idempotent if an event is ever processed twice.
// TABLE_PREFIX: set on the tab (double-click the tab), e.g. "anna_" -> table anna_body_positions.
const T = env.get('TABLE_PREFIX') || '';
const ev = msg.event;
let sky;
try {
  sky = computeSky(new Date(ev.time_iso), { latitude: ev.latitude, longitude: ev.longitude }, { orb: 8, riseSet: false });
} catch (err) {
  node.warn(`Sky calculation failed for event ${ev.id}: ${err.message}`);
  return null; // event stays sky_computed = 0 and is retried on the next poll
}

function bulk(table, cols, rows) {
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  return {
    topic: `REPLACE INTO ${table} (${cols.join(',')}) VALUES ${rows.map(() => ph).join(',')}`,
    payload: rows.flat(),
  };
}

const msgs = [bulk(T + 'body_positions', [
  'event_id', 'body', 'ra_hours', 'dec_deg', 'distance_au', 'azimuth_deg', 'altitude_deg',
  'above_horizon', 'ecl_lon_deg', 'ecl_lat_deg', 'zodiac_sign', 'degree_in_sign',
  'constellation', 'vis_magnitude', 'phase_fraction', 'retrograde', 'helio_lon_deg', 'helio_dist_au',
], sky.bodies.map((b) => [
  ev.id, b.body, b.equatorial.rightAscensionHours, b.equatorial.declinationDeg, b.equatorial.distanceAU,
  b.horizontal.azimuthDeg, b.horizontal.altitudeDeg, b.horizontal.aboveHorizon ? 1 : 0,
  b.ecliptic.longitudeDeg, b.ecliptic.latitudeDeg, b.ecliptic.sign, b.ecliptic.degreeInSign,
  b.constellation.name, b.magnitude, b.phaseFraction, b.retrograde ? 1 : 0,
  b.heliocentric ? b.heliocentric.longitudeDeg : null, b.heliocentric ? b.heliocentric.distanceAU : null,
]))];
if (sky.aspects.length) {
  msgs.push(bulk(T + 'aspects',
    ['event_id', 'body_a', 'body_b', 'aspect', 'separation_deg', 'orb_deg'],
    sky.aspects.map((a) => [ev.id, a.bodies[0], a.bodies[1], a.aspect, a.separationDeg, a.orbDeg])));
}
msgs.push({ topic: `UPDATE ${T}events SET moon_phase_deg = ?, sky_computed = 1 WHERE id = ?`, payload: [sky.moonPhaseDeg, ev.id] });
return [msgs];
