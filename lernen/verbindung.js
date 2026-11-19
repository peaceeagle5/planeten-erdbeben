// Datenbank-Zugang für die Übungen (Einheit 06 und 11).
//
// Standard: die Docker-Umgebung aus compose.yaml mit dem Benutzer "lernen" (darf nur lesen).
// Läuft deine Datenbank anders (z. B. XAMPP), trage die Werte in die Datei .env im Projektordner ein:
//   DB_HOST=127.0.0.1
//   DB_PORT=3306
//   DB_NAME=planeten_erdbeben
//   DB_USER=...
//   DB_PASSWORD=...
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_NAME: 'planeten_erdbeben', DB_USER: 'lernen', DB_PASSWORD: 'lernen' };

function readEnvFile() {
  try {
    const text = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    return Object.fromEntries(text.split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  } catch {
    return {};
  }
}

/** Verbindungsdaten für mysql2.createConnection(). */
function dbConfig() {
  const env = { ...DEFAULTS, ...readEnvFile() };
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectTimeout: 5000,
  };
}

module.exports = { dbConfig };
