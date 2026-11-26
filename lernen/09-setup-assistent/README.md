# 09 – Der Setup-Assistent

## Lernziele
- Du kannst erklären, wie der Assistent Node-RED, Grafana und die Datenbank fernsteuert.
- Du kennst Basic-Auth und Bearer-Token und weißt, wann welches benutzt wird.
- Du kannst die Sicherheitsmaßnahmen des lokalen Servers begründen.
- Du verstehst, wie aus JavaScript eine `.exe` wird.

Voraussetzung: Einheiten 03 (HTTP), 04 (async), 06, 07, 08.

---

## 1. Aufbau

```
Dein PC                                                              Raspberry Pi
┌──────────────────────────────────────────────┐
│ Browser: Setup-Seite (ui.html)               │
│   │ fetch('/api/test'), fetch('/api/install')│
│   ▼                                          │
│ Setup-Programm (server.js) auf 127.0.0.1:8790│──── SQL ───────────► MariaDB :3306
│   lib/db.js       ───────────────────────────│──── HTTP ──────────► Node-RED :1893 (Admin-API)
│   lib/nodered.js                             │──── HTTP ──────────► Grafana :3000  (HTTP-API)
│   lib/grafana.js                             │
└──────────────────────────────────────────────┘
```
Warum nicht einfach eine Webseite? Ein Browser darf aus Sicherheitsgründen weder direkt mit MySQL sprechen
noch beliebige fremde Server abfragen (**CORS**). Deshalb läuft ein kleines Programm auf dem PC, das diese
Verbindungen macht. Die Seite ist nur die Oberfläche.

## 2. Fernsteuerung über Admin-APIs

Alles, was du im Node-RED-Editor oder in Grafana per Klick machst, macht die Oberfläche selbst über HTTP-Anfragen.
Der Assistent schickt **dieselben** Anfragen.

| Aktion | Anfrage |
|---|---|
| Node-RED: Version, Einstellungen | `GET /settings` |
| Node-RED: Login nötig? | `GET /auth/login` → `{}` oder `{ type: 'credentials' }` |
| Node-RED: anmelden | `POST /auth/token` → `access_token` |
| Node-RED: MySQL-Node installieren | `POST /nodes { module: 'node-red-node-mysql' }` |
| Node-RED: Tab anlegen / ersetzen | `POST /flow` / `PUT /flow/<id>` |
| Node-RED: Inject-Knopf drücken (Backfill) | `POST /inject/<node-id>` |
| Grafana: läuft es? | `GET /api/health` |
| Grafana: wer bin ich, welche Rolle? | `GET /api/user`, `GET /api/user/orgs` |
| Grafana: Datenquelle anlegen | `POST /api/datasources` |
| Grafana: Dashboard hochladen | `POST /api/dashboards/db` |
| Grafana: Plugin da? (geht auch für Editor) | `GET /api/frontend/settings` → `panels` |
| Grafana: Plugin installieren (nur Server-Admin) | `POST /api/plugins/volkovlabs-echarts-panel/install` |
| Grafana: Dashboard im neuen Format lesen / speichern | `GET` / `PUT /apis/dashboard.grafana.app/v2/namespaces/default/dashboards/<uid>` |

Tipp: Öffne den Node-RED-Editor mit **F12 → Netzwerk** und klicke auf „Deploy“. Du siehst die Anfrage, die der
Assistent nachbaut.

## 3. Anmeldung: Basic und Bearer

```js
// Basic: Benutzer:Passwort, Base64-kodiert, bei JEDER Anfrage mitgeschickt (Grafana)
Authorization: 'Basic ' + Buffer.from('admin:geheim').toString('base64')   // 'Basic YWRtaW46Z2VoZWlt'

// Bearer: einmal anmelden, Token bekommen, dann nur noch den Token schicken (Node-RED)
Authorization: 'Bearer 3f9c…'
```
**Base64 ist keine Verschlüsselung!** Jede:r kann es zurückwandeln. Darum gehören Passwörter nur über
vertrauenswürdige Netze oder HTTPS. Im Schulnetz mit HTTP ist das ein bekanntes Risiko.

## 4. Mehrfach ausführbar (idempotent) und fremde Tabs schützen

- Datenbank: nur **fehlende** Tabellen anlegen, mit dem Präfix der Person (`anna_events` …). Fehlen in alten
  Tabellen neue Spalten, kommen sie per `ALTER TABLE` dazu, und die betroffenen Events werden zum Neuberechnen
  auf `sky_computed = 0` gesetzt.
- Plugin und „View“-Umschalter: nie fatal. Fehlen die Rechte oder ist Grafana zu alt, bleibt das Sonnensystem
  leer bzw. stehen Karte und Sonnensystem nebeneinander, der Rest wird trotzdem eingerichtet.
- Node-RED: den eigenen Tab am Backfill-Node erkennen (Node-RED vergibt neuen Tabs eine eigene ID, behält aber
  die Node-IDs) und ihn **ersetzen** statt einen zweiten anzulegen.
- Grafana: Datenquelle und Dashboard mit fester `uid` → `PUT`/`overwrite` statt Duplikat.
- **Besitzer:** In die Tab-Beschreibung kommt „Eingerichtet von: Name“. Steht dort ein anderer Name,
  bricht der Assistent ab, bis „Trotzdem überschreiben“ angekreuzt ist. Geprüft wird auf dem **Server**,
  nicht nur in der Seite, weil man Prüfungen im Browser umgehen kann.

## 5. Sicherheit des lokalen Servers

| Maßnahme | Schützt gegen |
|---|---|
| lauscht nur auf `127.0.0.1` | andere Rechner im Netz können das Setup nicht steuern |
| zufälliger **Token** in der Adresse und in jeder Anfrage (`X-Setup-Token`) | fremde Webseiten in deinem Browser, die heimlich `http://127.0.0.1:8790/api/install` aufrufen |
| `Host`-Header muss `127.0.0.1:<port>` sein | **DNS-Rebinding**: eine fremde Domain, die plötzlich auf 127.0.0.1 zeigt |
| Passwörter nie gespeichert, `localStorage` nur für Adressen/Namen | Passwörter liegen nicht auf Schul-PCs herum |
| Datenbankname per Regex geprüft | SQL-Injection über den Namen (Einheit 06) |

## 6. Fortschritt live anzeigen (NDJSON)

`/api/install` antwortet nicht einmal am Ende, sondern schickt während der Arbeit Zeile für Zeile JSON
(**N**ewline-**D**elimited JSON):
```
{"type":"step","id":"db","status":"running","message":"Datenbank wird eingerichtet ..."}
{"type":"log","message":"Tabelle events gibt es schon."}
{"type":"step","id":"db","status":"ok","message":"Datenbank und Tabellen sind bereit."}
```
Die Seite liest den Strom mit `res.body.getReader()`. Daten kommen in **Stücken**, die nicht an Zeilenenden
aufhören müssen. Deshalb sammelt der Code in einem Puffer und verarbeitet nur vollständige Zeilen.

## 7. Vom JavaScript zur .exe

[build.js](../../setup-wizard/build.js):
1. **esbuild** packt `server.js`, alle `lib/`-Dateien und das Paket `mysql2` in **eine** JavaScript-Datei (Bundle).
2. Node.js wird für jedes Zielsystem heruntergeladen (Windows, Linux x64, Linux ARM).
3. `node --build-sea` steckt das Bundle und die Dateien (Seite, SQL, Node-RED-Code) als **Assets** in eine Kopie
   von Node.js: eine **Single Executable Application**.

Darum sind die Dateien ~100–145 MB groß: Node.js ist komplett drin, dafür muss auf dem PC nichts installiert sein.
Im Programm liest [assets.js](../../shared/assets.js) die Dateien mit `sea.getAsset()`, beim Entwickeln von der Festplatte.

## Übung

[uebung.js](uebung.js): sieben Bausteine aus dem Assistenten. Prüfen: `node --test "lernen/09-setup-assistent/*.test.js"`

**Lese-Aufgabe:** Öffne [server.js](../../setup-wizard/server.js) und finde: (a) wo der Token geprüft wird,
(b) wo die Schritte nacheinander laufen, (c) woran der Datentest erkennt, dass Node-RED arbeitet.

## So erklärst du es
> „Der Assistent macht genau das, was du sonst mit der Maus machen würdest: Er klickt in Node-RED auf
> ‚Installieren‘ und ‚Deploy‘ und in Grafana auf ‚Datenquelle anlegen‘. Nur macht er das über dieselben
> Schnittstellen, die auch die Webseiten intern benutzen. Und er läuft nur auf deinem PC, damit niemand
> sonst damit Unfug machen kann.“

## Wenn es nicht klappt

| Beobachtung | Ursache |
|---|---|
| Windows: „Der Computer wurde durch Windows geschützt“ | Datei ist nicht signiert: „Weitere Informationen“ → „Trotzdem ausführen“ |
| Linux: `Permission denied` beim Start | `chmod +x planeten-erdbeben-setup-linux-x64` |
| Linux: `libatomic.so.1: cannot open shared object file` | Die eingebaute Node.js-Version braucht diese Systembibliothek: `sudo apt install libatomic1`. Gefunden, als die Datei zum ersten Mal in einem schlanken Linux-Container gestartet wurde. |
| Browser öffnet sich nicht | Adresse aus dem Konsolenfenster kopieren |
| „Die Setup-Sitzung ist abgelaufen“ | Programm wurde beendet oder neu gestartet: neue Adresse aus dem Fenster nehmen |
| Port 8790 belegt | Das Programm nimmt automatisch einen anderen freien Port |
| Raspberry Pi 32-Bit: Programm startet nicht | Für 32-Bit-ARM gibt es kein Node 26: Assistent am PC ausführen |

## Selbsttest-Fragen
1. Warum braucht der Assistent ein Programm auf dem PC und ist nicht einfach eine Webseite?
2. Was ist der Unterschied zwischen Basic-Auth und einem Bearer-Token?
3. Wogegen schützt der Token in der Adresse? Wogegen das Lauschen nur auf 127.0.0.1?
4. Warum wird die Besitzer-Prüfung auf dem Server wiederholt, obwohl die Seite sie schon macht?
5. Warum ist die Windows-Datei so groß?
