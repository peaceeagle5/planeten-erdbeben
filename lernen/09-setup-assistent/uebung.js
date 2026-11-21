// Einheit 09 – Bausteine aus dem Setup-Assistenten
// Prüfen: node --test "lernen/09-setup-assistent/*.test.js"

// 1. Adresse vereinheitlichen wie baseUrl() in setup-wizard/lib/nodered.js:
//    Leerzeichen weg, Schrägstriche am Ende weg, http:// davor, falls kein http:// oder https:// da ist.
//    baseUrl(' 192.168.100.133:1893/ ') → 'http://192.168.100.133:1893'
function baseUrl(url) {
  // TODO
}

// 2. Basic-Auth-Header: basicAuth('admin', 'geheim') → 'Basic YWRtaW46Z2VoZWlt'
//    Tipp: Buffer.from(text).toString('base64')
function basicAuth(user, password) {
  // TODO
}

// 3. Und zurück: Wer steckt in einem Basic-Header? (Zeigt, warum Base64 keine Verschlüsselung ist.)
//    decodeBasic('Basic YWRtaW46Z2VoZWlt') → { user: 'admin', password: 'geheim' }
//    Achtung: Das Passwort darf selbst ':' enthalten. Nur am ERSTEN ':' trennen.
function decodeBasic(header) {
  // TODO
}

// 4. Name → Kennung für Grafana-UIDs, wie slug() in setup-wizard/lib/grafana.js:
//    klein, alles außer a–z und 0–9 wird '-', keine '-' am Anfang/Ende, höchstens 28 Zeichen, leer → 'user'
//    slug('Pascal B.') → 'pascal-b', slug('  Ä!! ') → 'a'
//    Tipp für Umlaute: name.normalize('NFKD') zerlegt 'ü' in 'u' + Pünktchen (eigenes Zeichen im Bereich
//    \u0300–\u036f). Entferne die Pünktchen mit .replace(/[\u0300-\u036f]/g, ''), sonst wird daraus 'u-'.
//    Erst auf 28 Zeichen kürzen, dann '-' am Anfang/Ende entfernen.
function slug(name) {
  // TODO
}

// 5. Besitzer aus der Node-RED-Tab-Beschreibung lesen:
//    ownerFromInfo('Eingerichtet von: Pascal B. (2026-11-19)\n\nErstellt vom ...') → 'Pascal B.'
//    ownerFromInfo('Eingerichtet von: Nachbar\n...') → 'Nachbar'
//    ownerFromInfo('irgendwas') → null
function ownerFromInfo(info) {
  // TODO: Regulärer Ausdruck mit match()
}

// 6. Darf diese Anfrage an den lokalen Setup-Server? Nur wenn der Host-Header genau
//    '127.0.0.1:<port>' oder 'localhost:<port>' ist.
function isAllowedHost(hostHeader, port) {
  // TODO
}

// 7. NDJSON-Strom lesen: chunks ist ein Array von Text-Stücken, wie sie aus dem Netz kommen.
//    Ein Stück kann mitten in einer Zeile aufhören. Gib alle vollständigen Zeilen als Objekte zurück.
//    parseNdjson(['{"a":1}\n{"b"', ':2}\n']) → [{ a: 1 }, { b: 2 }]
//    Leere Zeilen überspringen. Ein unvollständiger Rest ganz am Ende wird ignoriert.
function parseNdjson(chunks) {
  // TODO: Puffer-Variable, indexOf('\n'), slice
}

module.exports = { baseUrl, basicAuth, decodeBasic, slug, ownerFromInfo, isAllowedHost, parseNdjson };
