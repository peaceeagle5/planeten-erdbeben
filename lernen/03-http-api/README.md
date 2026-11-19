# 03 – HTTP und APIs

## Lernziele
- Du kannst das Client-Server-Modell und den Ablauf einer HTTP-Anfrage erklären.
- Du kennst die wichtigsten Methoden, Statuscodes und Header.
- Du verstehst die Planeten-API [app.js](../../app.js) Zeile für Zeile.

---

## 1. Client und Server

```
Client (Browser, curl, Node-RED, Grafana)            Server (app.js, Grafana, Node-RED, USGS)
        │   ── Anfrage (Request) ──────────────────►        │
        │      GET /api/sky?lat=52.5&lon=13.4               │  rechnet
        │   ◄────────────────── Antwort (Response) ──       │
        │      200 OK, {"bodies": [...]}                    │
```
Wer fragt, ist der **Client**. Wer antwortet, der **Server**. Dasselbe Programm kann beides sein:
Node-RED ist Server für deinen Browser (Editor) und Client gegenüber USGS und der Datenbank.

## 2. Aufbau einer URL

```
http://192.168.100.133:3001/api/sky?lat=52.52&lon=13.405&date=2026-11-19T18:00:00Z
└┬─┘   └──────┬──────┘ └┬─┘└───┬──┘└─────────────────────┬────────────────────────┘
Schema      Host       Port   Pfad              Query (Parameter: name=wert, mit & getrennt)
```
In JavaScript zerlegt `new URL(...)` das für dich:
```js
const url = new URL('http://localhost:3001/api/sky?lat=52.52&lon=13.405');
url.pathname                  // '/api/sky'
url.searchParams.get('lat')   // '52.52'  ← Achtung: immer ein TEXT, nie eine Zahl!
url.searchParams.has('date')  // false
```
Sonderzeichen in Parametern müssen kodiert werden (`:` wird `%3A`), sonst geht die URL kaputt.
Das macht `encodeURIComponent('2026-11-18T03:12:45Z')` oder `URLSearchParams`.

## 3. Methoden und Statuscodes

| Methode | Bedeutung | Im Projekt |
|---|---|---|
| `GET` | Daten abholen, ändert nichts | `/api/sky`, USGS-Feed, Grafana `/api/health` |
| `POST` | Etwas Neues anlegen / Aktion auslösen | Grafana-Datenquelle anlegen, Node-RED-Tab anlegen |
| `PUT` | Etwas Vorhandenes ersetzen | Node-RED-Tab aktualisieren |
| `DELETE` | Löschen | Test-Dashboard löschen |

| Code | Bedeutung | Wann bei uns |
|---|---|---|
| **200** OK | Hat geklappt, Antwort hat Inhalt | `/api/sky` mit gültigen Werten |
| **204** No Content | Hat geklappt, keine Antwort nötig | Node-RED nach dem Deployen |
| **400** Bad Request | Anfrage ist falsch (Client-Fehler) | `lat=200` |
| **401** Unauthorized | Nicht angemeldet / Passwort falsch | Falsches Grafana-Passwort |
| **403** Forbidden | Angemeldet, aber nicht erlaubt | Setup-Seite ohne Token |
| **404** Not Found | Pfad gibt es nicht | `/api/skyy`, oder falscher Port |
| **405** Method Not Allowed | Pfad ja, Methode nein | `POST /api/sky` |
| **500** Internal Server Error | Fehler im Server-Code | Bug im Programm |

Merksatz: **4xx = der Client hat etwas falsch gemacht, 5xx = der Server.**

## 4. Header und JSON

Header sind Zusatzinfos zu Anfrage und Antwort:
- `Content-Type: application/json` – „im Inhalt steht JSON“
- `Authorization: Basic …` oder `Bearer …` – Anmeldedaten (Einheit 09)
- `Access-Control-Allow-Origin: *` – erlaubt Webseiten anderer Adressen, die API aufzurufen (CORS)

**JSON** ist Text, der wie ein JavaScript-Objekt aussieht:
```js
const text = JSON.stringify({ name: 'Apple', calories: 52 }); // Objekt → Text '{"name":"Apple","calories":52}'
const obj  = JSON.parse(text);                                // Text → Objekt
```
Über das Netz gehen immer nur **Texte**. Deshalb wird vor dem Senden umgewandelt und nach dem Empfangen zurück.

## 5. app.js Zeile für Zeile

```js
const server = http.createServer((req, res) => {       // diese Funktion läuft bei JEDER Anfrage
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  if (url.pathname === '/health') return send(res, 200, { status: 'ok' });
  if (url.pathname === '/api/sky') {
    try {
      const place = { latitude: parseNumber(q.get('lat'), 'lat', -90, 90), ... };  // prüfen!
      return send(res, 200, computeSky(date, place, { orb }));                       // rechnen + antworten
    } catch (err) {
      return send(res, 400, { error: err.message });                                  // falsche Eingabe
    }
  }
  send(res, 404, { error: 'Not found ...' });
});
server.listen(PORT, ...);                              // auf Port 3001 warten
```
Wichtig: **Eingaben von außen nie ungeprüft benutzen.** `parseNumber` prüft, ob `lat` wirklich eine Zahl
zwischen -90 und 90 ist. Ohne diese Prüfung würde `computeSky` mit Unsinn rechnen oder abstürzen.

## 6. Selbst ausprobieren

```
npm run api                                                 # Terminal 1
curl "http://localhost:3001/api/sky?lat=52.52&lon=13.405"   # Terminal 2
curl -i "http://localhost:3001/api/sky?lat=200&lon=0"       # -i zeigt Statuscode und Header
curl -i -X POST "http://localhost:3001/api/sky"
```
Im Browser: Adresse öffnen, dann **Entwicklertools (F12) → Netzwerk**. Dort siehst du Methode,
Statuscode, Header und Antwort jeder Anfrage. Das ist das wichtigste Werkzeug bei Web-Fehlern.

## Übung

[uebung.js](uebung.js): Eingaben prüfen, Query lesen, Routing und URLs bauen, wie in `app.js`.
Prüfen: `node --test lernen/03-http-api/`

**Bonus (ohne Test):** Baue in [bonus-server.js](bonus-server.js) eine kleine API für deine Lebensmittel:
`GET /foods` liefert alle, `GET /foods?maxCalories=60` filtert mit `filter`. Start: `node lernen/03-http-api/bonus-server.js`.

## So erklärst du es
> „HTTP ist wie ein Restaurant. Der Gast (Client) bestellt mit einer genauen Bestellung (URL mit Parametern),
> die Küche (Server) prüft, ob es das Gericht gibt, und bringt das Essen (JSON) mit einem Zettel:
> 200 heißt ‚bitte schön‘, 404 ‚haben wir nicht‘, 400 ‚Ihre Bestellung ergibt keinen Sinn‘.“

## Wenn es nicht klappt

| Beobachtung | Ursache |
|---|---|
| `curl: (7) Failed to connect` / Browser „nicht erreichbar“ | Server läuft nicht, oder falscher Port (Einheit 10) |
| 404 | Server läuft, aber Pfad falsch. Oder: an dem Port läuft ein **anderer** Server! |
| 400 mit Fehlermeldung | Lies die Meldung: Sie sagt, welcher Parameter falsch ist |
| `Unexpected token < in JSON` | Erwartet war JSON, gekommen ist HTML (meist eine Fehlerseite) |
| Zahl wird als Text verkettet (`"52" + 1 = "521"`) | Query-Parameter sind immer Texte: `Number()` benutzen |

## Selbsttest-Fragen
1. Warum ist `lat=abc` ein 400 und kein 500?
2. Was ist der Unterschied zwischen 401 und 403?
3. Warum muss das Datum in der URL mit `encodeURIComponent` kodiert werden?
4. Node-RED ist Client und Server zugleich. Erkläre, wann es was ist.
5. Ein Schüler bekommt im Browser „404“ auf Port 3000, obwohl Grafana dort läuft. Was könnte er falsch eingegeben haben?
