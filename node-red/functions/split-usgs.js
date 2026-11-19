// Input: USGS GeoJSON in msg.payload.
// Output: one INSERT per quake + one INSERT per paired control event.
// Control = same place as the quake, uniformly random time in the 2 years before it.
// This is the baseline: "what does the sky look like here when there is NO quake?"
const CONTROL_WINDOW_MS = 2 * 365.25 * 24 * 3600 * 1000;
const toSql = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
const SQL = 'INSERT IGNORE INTO events ' +
  '(kind, source_id, paired_with, time_utc, latitude, longitude, depth_km, magnitude, place) ' +
  'VALUES (?,?,?,?,?,?,?,?,?)';

const out = [];
for (const f of (msg.payload && msg.payload.features) || []) {
  const p = f.properties;
  if (p.type !== 'earthquake' || p.mag == null) continue;
  const [lon, lat, depth] = f.geometry.coordinates;
  const controlTime = p.time - Math.random() * CONTROL_WINDOW_MS;

  out.push({ topic: SQL, payload: ['earthquake', f.id, null, toSql(p.time), lat, lon, depth, p.mag, p.place] });
  out.push({ topic: SQL, payload: ['control', 'ctrl-' + f.id, f.id, toSql(controlTime), lat, lon, depth, p.mag, null] });
}
node.status({ text: `${out.length / 2} quakes @ ${new Date().toISOString().slice(11, 16)}Z` });
return [out];
