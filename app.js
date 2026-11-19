// HTTP API for planetary positions. Start with: node app.js
// Example: GET /api/sky?lat=52.52&lon=13.405&date=2026-11-19T18:00:00Z
const http = require('node:http');
const { computeSky } = require('./src/planets');

const PORT = Number(process.env.PORT) || 3001;

function parseNumber(value, name, min, max) {
  if (value === null || value === '') throw new Error(`Missing parameter: ${name}`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`Invalid ${name}: must be a number between ${min} and ${max}`);
  }
  return n;
}

function parseDate(value) {
  if (!value) return new Date(); // default: now
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date: use ISO 8601, e.g. 2026-11-19T18:00:00Z');
  return d;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body, null, 2));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  if (url.pathname === '/health') return send(res, 200, { status: 'ok' });

  if (url.pathname === '/api/sky') {
    try {
      const q = url.searchParams;
      const place = {
        latitude: parseNumber(q.get('lat'), 'lat', -90, 90),
        longitude: parseNumber(q.get('lon'), 'lon', -180, 180),
        elevation: q.has('elevation') ? parseNumber(q.get('elevation'), 'elevation', -500, 10000) : 0,
      };
      const date = parseDate(q.get('date'));
      const orb = q.has('orb') ? parseNumber(q.get('orb'), 'orb', 0, 15) : 8;
      return send(res, 200, computeSky(date, place, { orb }));
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
  }

  send(res, 404, { error: 'Not found. Try /api/sky?lat=52.52&lon=13.405' });
});

server.listen(PORT, () => {
  console.log(`Planet API listening on http://localhost:${PORT}`);
});
