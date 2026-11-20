// Input: PB2002 tectonic plates as GeoJSON in msg.payload (54 features, ~11 700 points).
// Output: per plate one upsert into `plates` (outline as MULTIPOLYGON) and the outline points
// in batches into `plate_points`. Upserts, so running it again changes nothing.
// Some plates come in several features (split at the date line): they are merged by code.
const PLATE_SQL = 'INSERT INTO plates (code, name, geom) VALUES (?, ?, ST_GeomFromText(?)) ' +
  'ON DUPLICATE KEY UPDATE name = VALUES(name), geom = VALUES(geom)';
const POINTS_PER_INSERT = 500;

const features = (msg.payload && msg.payload.features) || [];
if (!features.length) {
  node.error('Keine Platten in der Antwort (ist die URL erreichbar?)', msg);
  return null;
}

// code -> { name, polygons: [ [ring, ring, ...], ... ] }, ring = [[lon, lat], ...]
const plates = new Map();
for (const f of features) {
  const p = f.properties || {};
  const g = f.geometry || {};
  if (!p.Code || !g.coordinates) continue;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  if (!plates.has(p.Code)) plates.set(p.Code, { name: p.PlateName || p.Code, polygons: [] });
  plates.get(p.Code).polygons.push(...polygons);
}

const wktRing = (ring) => '(' + ring.map(([lon, lat]) => `${lon} ${lat}`).join(',') + ')';
const out = [];
let pointCount = 0;
for (const [code, { name, polygons }] of plates) {
  const wkt = 'MULTIPOLYGON(' + polygons.map((poly) => '(' + poly.map(wktRing).join(',') + ')').join(',') + ')';
  out.push({ topic: PLATE_SQL, payload: [code, name, wkt] });

  const rows = [];
  polygons.flat().forEach((ring, part) => ring.forEach(([lon, lat], seq) => rows.push([code, part, seq, lat, lon])));
  for (let i = 0; i < rows.length; i += POINTS_PER_INSERT) {
    const batch = rows.slice(i, i + POINTS_PER_INSERT);
    out.push({
      topic: 'INSERT INTO plate_points (code, part, seq, latitude, longitude) VALUES ' +
        batch.map(() => '(?,?,?,?,?)').join(',') +
        ' ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude)',
      payload: batch.flat(),
    });
  }
  pointCount += rows.length;
}
node.status({ text: `${plates.size} Platten, ${pointCount} Punkte @ ${new Date().toISOString().slice(11, 16)}Z` });
return [out];
