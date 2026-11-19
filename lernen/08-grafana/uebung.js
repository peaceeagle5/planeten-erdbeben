// Einheit 08 – Was Grafana mit deinen Abfragen macht
// Prüfen: node --test lernen/08-grafana/

// 1. Variablen ersetzen wie Grafana.
//    interpolate("WHERE body = '$body' AND magnitude >= $minmag", { body: 'Moon', minmag: 5 })
//    → "WHERE body = 'Moon' AND magnitude >= 5"
//    Unbekannte Variablen bleiben stehen. Auch die Schreibweise ${name} soll funktionieren.
//    Tipp: sql.replace(/\$\{?(\w+)\}?/g, (ganz, name) => ...)
function interpolate(sql, vars) {
  // TODO
}

// 2. Das Makro $__timeFilter(spalte) ersetzen.
//    from/to sind Date-Objekte. Format: 'YYYY-MM-DD HH:MM:SS' in UTC.
//    expandTimeFilter('SELECT * FROM events WHERE $__timeFilter(time_utc)', from, to)
//    → "SELECT * FROM events WHERE time_utc BETWEEN '2025-01-01 00:00:00' AND '2025-12-31 23:59:59'"
//    Tipp: date.toISOString() liefert '2025-01-01T00:00:00.000Z'
function expandTimeFilter(sql, from, to) {
  // TODO
}

// 3. Wie loadQueries() in grafana/dashboard-builder.js: Zerlegt queries.sql in nummerierte Abfragen.
//    Ein Block beginnt mit einer Zeile "-- ====", dann "-- N) Titel", dann "-- ====".
//    Ergebnis: { 1: 'SELECT ...', 2: 'SELECT ...' } ohne Kommentarzeilen, ohne ; am Ende, getrimmt.
function loadQueries(text) {
  // TODO
}

// 4. Ein minimales Grafana-Panel-Objekt:
//    makePanel(3, 'Beben pro Tag', 'timeseries', 'SELECT ...')
//    → { id: 3, title: 'Beben pro Tag', type: 'timeseries',
//        targets: [{ refId: 'A', rawSql: 'SELECT ...', format: 'table', rawQuery: true }] }
function makePanel(id, title, type, sql) {
  // TODO
}

module.exports = { interpolate, expandTimeFilter, loadQueries, makePanel };
