// Einheit 07 – Musterlösung

function addTimestamp(msg, node) {
  msg.receivedAt = new Date().toISOString();
  return msg;
}

function onlyStrong(msg, node) {
  return msg.payload >= 5 ? msg : null;
}

function splitFeatures(msg, node) {
  const out = msg.payload.features.map((f) => ({ payload: { id: f.id, mag: f.properties.mag } }));
  node.status({ text: `${out.length} Beben` });
  return [out];
}

function toInsert(msg, node) {
  const { id, mag, place } = msg.quake;
  return {
    topic: 'INSERT IGNORE INTO events (source_id, magnitude, place) VALUES (?,?,?)',
    payload: [id, mag, place],
  };
}

function routeByMagnitude(msg, node) {
  if (!Number.isFinite(msg.payload)) {
    node.warn('Ungültige Magnitude');
    return [null, null];
  }
  return msg.payload >= 6 ? [msg, null] : [null, msg];
}

function summary(msg, node) {
  const features = msg.payload.features;
  if (!features.length) {
    msg.payload = 'Keine Beben';
    return msg;
  }
  const strongest = features.reduce((best, f) => (f.properties.mag > best.properties.mag ? f : best));
  msg.payload = `${features.length} Beben, stärkstes: M${strongest.properties.mag} bei ${strongest.properties.place}`;
  return msg;
}

module.exports = { addTimestamp, onlyStrong, splitFeatures, toInsert, routeByMagnitude, summary };
