# 07 – Node-RED

## Lernziele
- Du kannst erklären, wie ein Flow funktioniert: Nodes, Drähte und das `msg`-Objekt.
- Du kannst Function-Nodes schreiben, die eine, mehrere oder keine Nachricht weitergeben.
- Du kannst den Flow „Planeten & Erdbeben“ Node für Node erklären und Fehler darin finden.

---

## 1. Die Idee

Node-RED ist **flussbasiertes Programmieren**: Statt einer langen Datei verbindet man Kästchen (**Nodes**)
mit Drähten. Durch die Drähte wandern **Nachrichten** (`msg`). Jeder Node bekommt eine Nachricht, macht
etwas damit und schickt sie weiter.

```
[inject] ──msg──► [http request] ──msg──► [function] ──msg──► [mysql]
 Zeitgeber          holt Daten             verändert          speichert
```

## 2. Das msg-Objekt

Eine Nachricht ist ein ganz normales JavaScript-Objekt. Zwei Eigenschaften sind Konvention:

| Eigenschaft | Bedeutung |
|---|---|
| `msg.payload` | der eigentliche Inhalt (Daten) |
| `msg.topic` | ein Thema / Betreff. **Beim mysql-Node: der SQL-Befehl!** |

Man darf beliebige weitere Eigenschaften anhängen (bei uns z. B. `msg.event`). Sie reisen mit durch den Flow,
auch durch Nodes, die nur `payload` verändern. Das nutzt unser Flow: Der mysql-Node ersetzt `payload` durch das
Ergebnis, `msg.event` bleibt erhalten.

## 3. Function-Nodes

Im Function-Node steht JavaScript. Es bekommt `msg` und muss etwas **zurückgeben**:

| Rückgabe | Wirkung |
|---|---|
| `return msg;` | eine Nachricht weiter |
| `return null;` | **nichts** weiter, der Fluss stoppt hier (Filter) |
| `return [[m1, m2, m3]];` | **mehrere** Nachrichten nacheinander aus Ausgang 1 |
| `return [m1, m2];` | Nachricht `m1` aus Ausgang 1, `m2` aus Ausgang 2 (bei 2 Ausgängen) |

Achtung, die Klammern: `[m1, m2]` = zwei **Ausgänge**, `[[m1, m2]]` = zwei Nachrichten aus **einem** Ausgang.
Unser [split-usgs.js](../../node-red/functions/split-usgs.js) endet mit `return [out];` (out ist ein Array):
viele INSERT-Nachrichten aus einem Ausgang.

Hilfsmittel im Function-Node:
- `node.warn('Text')` – erscheint gelb im **Debug-Fenster** (rechts, Käfer-Symbol)
- `node.status({ text: '12 pending' })` – kleiner Text **unter** dem Node im Editor
- `env.get('NAME')` – Umgebungsvariable des Flows
- **Setup-Tab → Module:** npm-Pakete einbinden. Bei uns: `astronomy-engine` als Variable `Astronomy`.
  Node-RED installiert es beim Deployen selbst (braucht Internet).

## 4. Unser Flow, Node für Node

Den Code baut [flow-builder.js](../../node-red/flow-builder.js) zusammen.

**Teil 1: Erdbeben holen**
| Node | Typ | Was er macht |
|---|---|---|
| alle 5 min | inject | startet alle 300 s, einmal 5 s nach dem Start |
| USGS M4.5+ letzter Tag | http request | `GET` auf den USGS-Feed, Antwort als Objekt in `msg.payload` |
| Backfill 2025 M5+ | inject | nur per Klick; `payload` = `{"start","end","minmag"}` |
| USGS-Abfrage bauen | function | baut aus dem payload die Katalog-URL in `msg.url` ([backfill-url.js](../../node-red/functions/backfill-url.js)) |
| USGS Katalog | http request | URL leer → nimmt `msg.url` |
| Beben + Kontrollen → SQL | function | pro Beben 2 Nachrichten mit `INSERT IGNORE` ([split-usgs.js](../../node-red/functions/split-usgs.js)) |
| INSERT anna_events | mysql | führt `msg.topic` mit den Werten aus `msg.payload` aus |

**Teil 2: Planeten berechnen**
| Node | Typ | Was er macht |
|---|---|---|
| jede Minute | inject | `topic` = SELECT der bis zu 600 Events mit `sky_computed = 0` |
| SELECT offene | mysql | Ergebnis: Array von Zeilen in `msg.payload` |
| eine Nachricht pro Event | function | Array → einzelne Nachrichten mit `msg.event` ([split-pending.js](../../node-red/functions/split-pending.js)) |
| 20 / s | delay | höchstens 20 Nachrichten pro Sekunde, damit der Pi nicht überlastet |
| Himmel berechnen → SQL | function | `computeSky()` + 3 SQL-Nachrichten ([compute-sky.js](../../node-red/functions/compute-sky.js)) |
| WRITE Positionen | mysql | schreibt `body_positions` (auch die Positionen von der Sonne aus), `aspects`, setzt `sky_computed = 1` |

**Teil 3: Plattengrenzen** holt beim Start und dann jede Woche die tektonischen Platten (PB2002) von GitHub und
schreibt sie in `plates` und `plate_points` ([plates-sql.js](../../node-red/functions/plates-sql.js)).

**Fehler:** Der **catch**-Node fängt Fehler aller Nodes im Tab und schickt sie an den **debug**-Node.

**Eigene Tabellen:** Welche Tabellen der Flow benutzt, steht in der **Umgebungsvariable des Tabs** `TABLE_PREFIX`
(Doppelklick auf den Tab → „Umgebungsvariablen“), z. B. `anna_`. Die Function-Nodes lesen sie mit
`env.get('TABLE_PREFIX')` und schreiben dann in `anna_events` usw. Leer = die Tabellen ohne Präfix.

**Warum zwei getrennte Teile?** Wenn die Berechnung ausfällt, gehen keine Beben verloren: sie warten mit
`sky_computed = 0` und werden beim nächsten Durchlauf berechnet. Die Datenbank ist die **Warteschlange**.

## 5. Konfigurations-Nodes und Passwörter

Der MySQL-Zugang steckt in einem **Konfigurations-Node** (`MySQLdatabase`), den alle mysql-Nodes teilen.
Benutzer und Passwort speichert Node-RED **verschlüsselt** in `flows_cred.json`, nicht in `flows.json`.
Deshalb kann man `flows.json` weitergeben, ohne Passwörter zu verraten. Der Schlüssel steht in `settings.js`
(`credentialSecret`) oder wird automatisch erzeugt.

## Übung

1. **Function-Nodes** in [uebung.js](uebung.js). Prüfen: `node --test "lernen/07-node-red/*.test.js"`
2. **Im Editor** (http://127.0.0.1:1880 oder dein eigener Port): Baue den Flow
   `inject → http request (USGS-Feed) → function → debug`, der im Debug-Fenster ausgibt:
   „12 Beben, stärkstes: M6.1 bei …“. Musterlösung zum Importieren (Menü → Import): [loesung-flow.json](loesung-flow.json).

## So erklärst du es
> „Node-RED ist wie eine Fließband-Fabrik. Jedes Kästchen ist eine Station, die Drähte sind das Band,
> und auf dem Band liegen Pakete: die Nachrichten. Im Paket ist der Inhalt (payload) und ein Aufkleber (topic).
> Eine Function-Station kann ein Paket verändern, aufteilen oder aussortieren.“

## Wenn es nicht klappt

| Beobachtung | Ursache / Was tun |
|---|---|
| Node hat **rotes Dreieck** | Pflichtfeld fehlt oder unbekannter Node-Typ (z. B. mysql nicht installiert: Palette verwalten) |
| Unter dem mysql-Node: „not connected“ / rot | Datenbank nicht erreichbar oder Login falsch: Doppelklick auf den Konfigurations-Node |
| Nichts passiert nach Deploy | Inject-Node nicht ausgelöst, oder Draht fehlt. Debug-Node anhängen und schauen, wo die Nachricht stehen bleibt |
| „Planet API failed …“ / „Sky calculation failed“ | Im Debug-Fenster die genaue Meldung lesen |
| Function: `Astronomy is not defined` | Setup-Tab: Modul `astronomy-engine` mit Variable `Astronomy` fehlt, oder `functionExternalModules: false` |
| Alle Events bleiben `pending` | Teil 2 läuft nicht: Inject „jede Minute“ und den mysql-Node prüfen |
| Daten doppelt | Zwei Tabs/Instanzen schreiben dasselbe; bei uns harmlos (INSERT IGNORE), aber unnötig |

**Faustregel zum Debuggen:** Hänge an jeden Node nacheinander einen debug-Node (Ausgabe: „vollständiges
msg-Objekt“) und schau, wo die Nachricht noch richtig ist und wo nicht mehr.

## Selbsttest-Fragen
1. Was ist der Unterschied zwischen `return [a, b]` und `return [[a, b]]`?
2. Wie weiß der mysql-Node, welchen SQL-Befehl er ausführen soll?
3. Warum ist der Flow in zwei unabhängige Teile getrennt? Was passiert bei einem Absturz mitten in Teil 2?
4. Wozu ist der delay-Node „20 / s“ da?
5. Warum stehen die Datenbank-Passwörter nicht in `flows.json`?
