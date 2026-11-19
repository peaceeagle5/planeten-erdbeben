// Einheit 03 – Musterlösung

function parseNumber(value, name, min, max) {
  if (value === null || value === '') throw new Error(`Missing parameter: ${name}`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Invalid ${name}`);
  return n;
}

function readPlace(urlText) {
  const q = new URL(urlText).searchParams;
  return {
    latitude: parseNumber(q.get('lat'), 'lat', -90, 90),
    longitude: parseNumber(q.get('lon'), 'lon', -180, 180),
  };
}

function statusFor(method, pathname) {
  if (method !== 'GET') return 405;
  if (pathname === '/health' || pathname === '/api/sky') return 200;
  return 404;
}

function skyUrl(base, lat, lon, dateIso) {
  return `${base}/api/sky?lat=${lat}&lon=${lon}&date=${encodeURIComponent(dateIso)}`;
}

function makeResponse(status, data) {
  return {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data),
  };
}

module.exports = { parseNumber, readPlace, statusFor, skyUrl, makeResponse };
