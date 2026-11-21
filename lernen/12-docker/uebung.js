// Einheit 12 – Docker-Angaben verstehen
// Prüfen: node --test "lernen/12-docker/*.test.js"

// 1. Image-Namen zerlegen.
//    parseImage('nodered/node-red:5.0.10') → { repository: 'nodered/node-red', tag: '5.0.10' }
//    parseImage('mariadb')                → { repository: 'mariadb', tag: 'latest' }   (ohne Tag = latest)
//    Achtung: Der Doppelpunkt kann auch zu einem Port gehören: 'localhost:5000/meinbild' hat KEINEN Tag.
//    Tipp: Nur ein ':' NACH dem letzten '/' trennt den Tag.
function parseImage(image) {
  // TODO
}

// 2. Ist die Version fest angegeben? false bei 'latest' oder ganz ohne Tag.
function isPinned(image) {
  // TODO: benutze parseImage
}

// 3. Port-Angabe aus compose.yaml zerlegen:
//    parsePort('127.0.0.1:3306:3306') → { hostIp: '127.0.0.1', hostPort: 3306, containerPort: 3306 }
//    parsePort('8080:80')             → { hostIp: '0.0.0.0',  hostPort: 8080, containerPort: 80 }  (ohne IP = alle!)
//    parsePort('3000')                → { hostIp: '0.0.0.0',  hostPort: 3000, containerPort: 3000 }
function parsePort(spec) {
  // TODO
}

// 4. Ist der Port nur vom eigenen PC aus erreichbar?
function onlyLocal(spec) {
  // TODO: benutze parsePort
}

// 5. Compose-Variablen ersetzen: ${NAME} und ${NAME:-standard}
//    expandVars('127.0.0.1:${DB_PORT:-3306}:3306', {})                  → '127.0.0.1:3306:3306'
//    expandVars('127.0.0.1:${DB_PORT:-3306}:3306', { DB_PORT: '3307' }) → '127.0.0.1:3307:3306'
//    expandVars('${X}', {}) → ''   (unbekannt ohne Standard = leer)
//    Tipp: text.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (ganz, name, standard) => …)
function expandVars(text, env) {
  // TODO
}

// 6. Welche Datenbank-Adresse benutzt wer? who = 'pc' oder 'container'
//    dbAddress('pc') → '127.0.0.1:3306', dbAddress('container') → 'mariadb:3306'
function dbAddress(who) {
  // TODO
}

module.exports = { parseImage, isPinned, parsePort, onlyLocal, expandVars, dbAddress };
