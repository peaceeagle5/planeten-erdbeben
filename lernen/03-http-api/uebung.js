// Einheit 03 – HTTP und APIs
// Prüfen: node --test lernen/03-http-api/

// 1. Wie parseNumber in app.js:
//    - value ist null oder ''  → throw new Error(`Missing parameter: ${name}`)
//    - keine gültige Zahl oder außerhalb min..max → throw new Error(`Invalid ${name}`)
//    - sonst die Zahl zurückgeben (als number, nicht als Text!)
function parseNumber(value, name, min, max) {
  // TODO
}

// 2. Liest lat und lon aus einer URL und prüft sie mit parseNumber.
//    readPlace('http://x/api/sky?lat=52.5&lon=13.4') → { latitude: 52.5, longitude: 13.4 }
//    Tipp: new URL(text).searchParams.get('lat')
function readPlace(urlText) {
  // TODO
}

// 3. Routing: Welcher Statuscode für welche Anfrage?
//    nicht GET           → 405
//    GET /health         → 200
//    GET /api/sky        → 200
//    jeder andere Pfad   → 404
function statusFor(method, pathname) {
  // TODO
}

// 4. Baut die Adresse für die Planeten-API. Das Datum muss kodiert werden.
//    skyUrl('http://localhost:3001', 38.29, 142.37, '2026-11-18T03:12:45Z')
//    → 'http://localhost:3001/api/sky?lat=38.29&lon=142.37&date=2026-11-18T03%3A12%3A45Z'
//    Tipp: encodeURIComponent
function skyUrl(base, lat, lon, dateIso) {
  // TODO
}

// 5. Baut die Antwort wie send() in app.js, aber ohne Server:
//    { status, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: <JSON-Text> }
function makeResponse(status, data) {
  // TODO
}

module.exports = { parseNumber, readPlace, statusFor, skyUrl, makeResponse };
