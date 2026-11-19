# Lernpfad: Planeten & Erdbeben verstehen

Diese Lerneinheiten erklären jeden Teil des Projekts so, dass du ihn **verstehst**, **erklären** kannst
und **helfen** kannst, wenn etwas nicht funktioniert. Sie starten bei deinem JavaScript-Stand
(Variablen, Funktionen, Arrays, Objekte, `filter`/`map`/`reduce`) und bauen darauf auf.

## Bevor du anfängst

Installation und Start der Docker-Umgebung: **[ERSTE-SCHRITTE.md](../ERSTE-SCHRITTE.md)**.

| Einheiten | Was du brauchst |
|---|---|
| 00–05, 09, 10, 12, 13 und die JavaScript-Übungen in 06, 07, 08, 11 | nur **Node.js** (für die Praxis in 12 Docker, in 13 Git) |
| SQL-Aufgaben (06), Editor-Übung (07), Grafana-Übung (08), Analyse (11) | zusätzlich die **Docker-Umgebung** (`docker compose up -d`), eingerichtet mit `npm run setup` |

## So arbeitest du damit

1. Lies die Einheit (`README.md` im jeweiligen Ordner) von oben nach unten.
2. Öffne `uebung.js` und ersetze die `TODO`s durch deinen Code.
3. Prüfe dich selbst:
   ```
   node --test lernen/01-js-werkzeuge/
   ```
   Grün ✔ = richtig, rot ✖ = schau dir die Meldung an (sie sagt, was erwartet wurde).
4. Erst danach in `loesung.js` schauen. Deine Lösung darf anders aussehen, solange die Tests grün sind.
5. Beantworte die **Selbsttest-Fragen** laut, als würdest du es jemandem erklären.

Alle Tests auf einmal: `npm run lernen`. Nur die Musterlösungen prüfen: `LOESUNG=1 npm run lernen`.

## Die Einheiten

| # | Einheit | Worum es geht | Zeit |
|---|---|---|---|
| 00 | [Das Gesamtbild](00-gesamtbild/README.md) | Welche Teile gibt es, wie fließen die Daten, welche Ports? | 45 min |
| 01 | [JavaScript-Werkzeuge](01-js-werkzeuge/README.md) | Template-Strings, Destructuring, `??`, `?.`, Spread: alles, was im Projektcode vorkommt | 2 h |
| 02 | [Module und npm](02-module-npm/README.md) | `require`, `module.exports`, `package.json`, `node_modules` | 1 h |
| 03 | [HTTP und APIs](03-http-api/README.md) | Client/Server, URL, Statuscodes, JSON, die Planeten-API (`app.js`) | 2 h |
| 04 | [Asynchrones JavaScript](04-async/README.md) | Promise, `async`/`await`, `fetch`, `try`/`catch` | 2 h |
| 05 | [Die Planeten-Berechnung](05-planeten/README.md) | Koordinaten, Tierkreis, Aspekte, rückläufige Planeten (`src/planets.js`) | 2 h |
| 06 | [Datenbank und SQL](06-datenbank-sql/README.md) | Tabellen, Schlüssel, JOIN, GROUP BY, SQL-Injection | 3 h |
| 07 | [Node-RED](07-node-red/README.md) | Flows, das `msg`-Objekt, Function-Nodes, unser Flow | 2 h |
| 08 | [Grafana](08-grafana/README.md) | Datenquelle, Panels, Variablen, Makros | 1,5 h |
| 09 | [Der Setup-Assistent](09-setup-assistent/README.md) | Automatisierung über Admin-APIs, Sicherheit, Programmdateien bauen | 2 h |
| 10 | [Netzwerk und Fehlersuche](10-netzwerk-fehlersuche/README.md) | IP, Ports, typische Fehler, systematisch vorgehen | 2 h |
| 11 | [Statistik: Was die Daten zeigen können](11-statistik/README.md) | Kontrollgruppe, Zufall, Korrelation ≠ Ursache | 1 h |
| 12 | [Docker](12-docker/README.md) | Image, Container, Volume, Ports, compose.yaml, eigenes Dockerfile | 2 h |
| 13 | [Git und GitHub](13-git-github/README.md) | Commits, Branches, .gitignore, Pull Requests, Passwort-Notfall | 2 h |

Zum Nachschlagen für den Unterricht: [Erklär-Spickzettel](spickzettel.md).

## Reihenfolge

```
00 ─► 01 ─► 02 ─► 03 ─► 04 ─┬─► 05
                            ├─► 06 ─► 07 ─► 08
                            └─► 09 (braucht 03, 04, 06, 07, 08)
10 jederzeit, am besten nach 03       11 nach 06
12 nach 10 (am besten vor dem ersten docker compose up)
13 jederzeit, am besten früh: dann versionierst du alle Übungen
```

## Bezug zur Ausbildung (FIAE)

Vieles hier ist prüfungsrelevant: Client-Server-Modell, HTTP, relationale Datenbanken und SQL,
Normalisierung, Schlüssel, Sicherheit (SQL-Injection, Passwörter), Testen, Fehleranalyse und
das Erklären technischer Zusammenhänge für Nicht-Fachleute. Die Selbsttest-Fragen am Ende jeder
Einheit sind im Stil von Prüfungsfragen formuliert.
