// Einheit 10 – Musterlösung

function isLoopback(host) {
  const h = String(host || '').trim().toLowerCase();
  return h === 'localhost' || h === '::1' || h.startsWith('127.');
}

const LAYERS = {
  ETIMEDOUT: 1, EHOSTUNREACH: 1, ENOTFOUND: 1,
  ECONNREFUSED: 2,
  404: 3,
  401: 4, ER_ACCESS_DENIED_ERROR: 4,
  403: 5, ER_HOST_NOT_PRIVILEGED: 5, ER_DBACCESS_DENIED_ERROR: 5,
};

function layerOf(error) {
  return LAYERS[error] ?? null; // Objekt-Schlüssel sind Texte: LAYERS[404] findet '404'
}

function nextCheck(error) {
  const checks = { 1: 'ping', 2: 'port', 3: 'curl', 4: 'login', 5: 'rechte' };
  return checks[layerOf(error)] ?? 'log';
}

module.exports = { isLoopback, layerOf, nextCheck };
