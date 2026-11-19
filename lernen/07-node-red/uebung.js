// Einheit 07 – Function-Nodes
// Jede Funktion bekommt (msg, node) wie im Node-RED-Function-Node und gibt zurück, was der Node ausgeben soll.
// Prüfen: node --test lernen/07-node-red/

// 1. Hängt die Empfangszeit an: msg.receivedAt = new Date().toISOString(), dann msg weitergeben.
function addTimestamp(msg, node) {
  // TODO
}

// 2. Filter: msg.payload ist eine Magnitude (Zahl).
//    Ab 5.0 weitergeben, sonst nichts weitergeben (Fluss stoppt).
function onlyStrong(msg, node) {
  // TODO
}

// 3. msg.payload ist ein USGS-Feed { features: [...] }.
//    Gib eine Nachricht PRO feature aus einem Ausgang aus. Jede mit payload = { id, mag }.
//    (id = feature.id, mag = feature.properties.mag)
//    Setze außerdem node.status({ text: '<Anzahl> Beben' }).
function splitFeatures(msg, node) {
  // TODO: return [ [...] ]
}

// 4. Für den mysql-Node: msg.quake = { id, mag, place } wird zu
//    topic:   'INSERT IGNORE INTO events (source_id, magnitude, place) VALUES (?,?,?)'
//    payload: [id, mag, place]
//    Gib eine NEUE Nachricht { topic, payload } zurück.
function toInsert(msg, node) {
  // TODO
}

// 5. Zwei Ausgänge: msg.payload ist eine Magnitude.
//    Ausgang 1 bekommt die Nachricht bei Magnitude >= 6, Ausgang 2 bei kleineren.
//    Der jeweils andere Ausgang bekommt null.
//    Bei einer ungültigen Zahl: node.warn('Ungültige Magnitude') und an keinen Ausgang etwas.
function routeByMagnitude(msg, node) {
  // TODO: return [msgOderNull, msgOderNull]
}

// 6. Zusammenfassung für den Editor-Flow aus der README:
//    msg.payload = USGS-Feed. Setze msg.payload auf den Text
//    '<Anzahl> Beben, stärkstes: M<mag> bei <place>'   (stärkstes = größte mag)
//    Bei 0 Beben: 'Keine Beben'
function summary(msg, node) {
  // TODO: reduce findet das stärkste
}

module.exports = { addTimestamp, onlyStrong, splitFeatures, toInsert, routeByMagnitude, summary };
