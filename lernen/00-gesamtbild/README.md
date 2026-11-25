# 00 – Das Gesamtbild

## Lernziele
- Du kannst alle Teile des Systems benennen und sagen, was jeder Teil tut.
- Du kannst den Weg **eines** Erdbebens von USGS bis ins Grafana-Dashboard nacherzählen.
- Du weißt, welcher Dienst auf welchem Port läuft.

## Die Frage hinter dem Projekt

> Gibt es einen Zusammenhang zwischen der Stellung der Planeten und Erdbeben?

Um das zu prüfen, brauchen wir für **jedes** Erdbeben: Wann und wo war es, und wie standen in diesem
Moment Sonne, Mond und Planeten? Dann vergleichen wir mit Zeitpunkten **ohne** Erdbeben (Einheit 11).

## Die Teile

```
 ┌──────────────┐  alle 5 min   ┌─────────────────────────────┐   SQL    ┌──────────────┐   SQL   ┌───────────┐
 │ USGS         │ ────────────► │ Node-RED                    │ ───────► │ MariaDB      │ ◄────── │ Grafana   │
 │ (Internet)   │   GeoJSON     │ 1. Erdbeben holen           │  INSERT  │ (Datenbank)  │ SELECT  │ (Dashboard│
 │ Erdbebendaten│               │ 2. Planeten berechnen       │          │              │         │  im Browser)
 └──────────────┘  GitHub:      │ 3. Plattengrenzen holen     │          │              │         │           │
                   Platten      └─────────────────────────────┘          └──────────────┘         └───────────┘
                                   Port 1880 (bzw. 1892, 1893 …)          Port 3306                 Port 3000
```

| Teil | Was er tut | Womit | Port |
|---|---|---|---|
| **USGS** | Der US Geological Survey veröffentlicht alle Erdbeben weltweit als Daten im Internet. | GeoJSON über HTTPS | 443 |
| **Node-RED** | Holt die Erdbeben, berechnet für jedes die Planetenstellung und schreibt alles in die Datenbank. Holt außerdem einmal pro Woche die Grenzen der tektonischen Platten. Läuft ständig. | Flows aus Nodes, JavaScript | 1880 (Standard), bei euch pro Person eigener Port |
| **astronomy-engine** | JavaScript-Bibliothek, die Planetenpositionen genau berechnet. Wird in Node-RED benutzt. | npm-Paket | – |
| **MariaDB** | Speichert alles dauerhaft in Tabellen. | SQL | 3306 |
| **Grafana** | Liest aus der Datenbank und zeigt Karten und Diagramme. | SQL, Browser | 3000 |
| **Setup-Assistent** | Richtet Datenbank, Node-RED und Grafana automatisch ein. Läuft nur kurz auf dem eigenen PC. | Node.js | 8790 (nur lokal) |
| **Planeten-API** (`app.js`) | Optional: dieselbe Berechnung als Webdienst. Für das System nicht mehr nötig. | Node.js, HTTP | 3001 |

## Der Weg eines Erdbebens

1. **USGS** meldet: Am 18.11.2026 um 03:12 UTC bebte bei Japan die Erde, Magnitude 6,1, 24 km tief.
2. **Node-RED** fragt alle 5 Minuten die USGS-Liste ab ([split-usgs.js](../../node-red/functions/split-usgs.js)).
   Für jedes Beben entstehen **zwei** Zeilen in der Tabelle `events`:
   das echte Beben und ein **Kontroll-Event** (gleicher Ort, zufällige Zeit).
3. **Node-RED** schaut jede Minute nach Events ohne Planetendaten (`sky_computed = 0`)
   und berechnet sie ([compute-sky.js](../../node-red/functions/compute-sky.js), mit [src/planets.js](../../src/planets.js)).
4. Das Ergebnis landet in den Tabellen `body_positions` (10 Zeilen: Sonne, Mond, 8 Planeten, von der Erde
   und von der Sonne aus gesehen) und `aspects` (Winkelbeziehungen zwischen den Himmelskörpern).
   Im Unterricht hat jede:r eigene Tabellen mit dem Namen davor, z. B. `anna_events`.
5. **Grafana** fragt die Datenbank per SQL ab ([queries.sql](../../grafana/queries.sql)) und zeigt
   z. B. „Mondphase bei Erdbeben vs. bei Kontroll-Events“. Ein Klick auf das Beben in der Karte zeigt den
   Himmel und das Sonnensystem in genau diesem Moment.

## Wichtige Begriffe

- **Dienst / Server:** Ein Programm, das dauerhaft läuft und auf Anfragen wartet.
- **Port:** Eine Nummer, unter der ein Dienst auf einem Rechner erreichbar ist. IP-Adresse = Hausnummer,
  Port = Wohnungsnummer. Zwei Dienste können **nicht** denselben Port benutzen (siehe Einheit 10).
- **Client:** Wer eine Anfrage stellt (Browser, Node-RED gegenüber der Datenbank, Grafana gegenüber der Datenbank).
- **UTC:** Weltzeit ohne Sommerzeit. Alle Zeiten im Projekt sind UTC, damit nichts durcheinanderkommt.

## Übung

Öffne [antworten.txt](antworten.txt) und schreib deine Antworten hinter die Doppelpunkte. Kein Programmieren nötig.
Prüfen: `node --test "lernen/00-gesamtbild/*.test.js"`

Zusatzaufgabe ohne Code: Zeichne das Bild oben aus dem Gedächtnis auf Papier, mit Ports und Pfeilrichtungen.

## So erklärst du es

> „Node-RED ist unser Sammler: Es holt die Erdbeben aus dem Internet und rechnet aus, wo die Planeten
> gerade standen. Alles kommt in die Datenbank, das ist unser Gedächtnis. Grafana ist das Schaufenster:
> Es liest aus der Datenbank und malt Diagramme. Jeder dieser drei Dienste hat seinen eigenen Port,
> so wie jede Wohnung im Haus ihre eigene Nummer hat.“

## Wenn es nicht klappt

| Beobachtung | Welcher Teil ist betroffen? |
|---|---|
| Dashboard leer, Zähler „pending“ steigt | Node-RED rechnet nicht (Einheit 07) |
| Dashboard leer, Zähler bleibt bei 0 | Node-RED holt nichts oder erreicht die Datenbank nicht (Einheiten 07, 10) |
| Grafana zeigt „Datenquelle nicht erreichbar“ | Verbindung Grafana → Datenbank (Einheiten 08, 10) |
| Browser: „Seite nicht erreichbar“ | Dienst läuft nicht oder falscher Port (Einheit 10) |

## Selbsttest-Fragen
1. Warum werden die Planetenpositionen in der Datenbank gespeichert und nicht jedes Mal in Grafana neu berechnet?
2. Was passiert mit neuen Erdbeben, während die Datenbank kurz ausgefallen ist?
3. Welche Teile müssen dauerhaft laufen, welcher nur einmal zum Einrichten?
4. Erkläre den Unterschied zwischen IP-Adresse und Port mit einem eigenen Vergleich.
