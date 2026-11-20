# Lernpfad: Planeten & Erdbeben verstehen

Diese Lerneinheiten erklären jeden Teil des Projekts so, dass du ihn **verstehst**, **erklären** kannst
und **helfen** kannst, wenn etwas nicht funktioniert. Es gibt zwei Lernwege: einen für die
**Anwendungsentwicklung** (mit JavaScript) und einen für die **Systemintegration** (ganz ohne Programmieren).

## Bevor du anfängst

Installation und Start der Docker-Umgebung: **[ERSTE-SCHRITTE.md](../ERSTE-SCHRITTE.md)**.
Einmal im Projektordner: `npm install`.

## Zwei Lernwege

| | **Anwendungsentwicklung (FIAE)** | **Systemintegration (FISI)** |
|---|---|---|
| Schwerpunkt | den Code verstehen und erweitern | Dienste betreiben, Netzwerk, Datenbank, Infrastruktur |
| Einheiten | alle, Kern: 00–09, 11 | 00, 06, 08, 10, 12, 13, **14**, **15** (07 zum Lesen) |
| Übungen | JavaScript-Funktionen **und** Praxis-Übungen | nur Praxis-Übungen: Antworten in Textdateien, SQL, Dockerfile, Git |
| Alles prüfen | `npm run lernen` | `npm run lernen:fisi` |

Die Erklärungen jeder Einheit kann man unabhängig vom Lernweg lesen. Unterschiedlich ist, **welche Übungen** man macht.

## Die Einheiten

**Übungsarten:** **JS** = JavaScript-Funktionen schreiben (`uebung.js`) · **Praxis** = ohne Programmieren
(Antworten in `.txt`-Dateien, SQL, Dockerfile, eigenes Git-Repository) · **Hand** = am echten System, ohne
automatische Prüfung.

| # | Einheit | Worum es geht | Übungen | FIAE | FISI | Zeit |
|---|---|---|---|:-:|:-:|---|
| 00 | [Das Gesamtbild](00-gesamtbild/README.md) | Bausteine, Datenfluss, Ports | Praxis (Quiz) | ● | ● | 45 min |
| 01 | [JavaScript-Werkzeuge](01-js-werkzeuge/README.md) | Template-Strings, Destructuring, `??`, `?.`, Spread | JS | ● | | 2 h |
| 02 | [Module und npm](02-module-npm/README.md) | `require`, `package.json`, `node_modules` | JS | ● | | 1 h |
| 03 | [HTTP und APIs](03-http-api/README.md) | Client/Server, URL, Statuscodes, JSON | JS | ● | ○ | 2 h |
| 04 | [Asynchrones JavaScript](04-async/README.md) | Promise, `async`/`await`, `fetch` | JS | ● | | 2 h |
| 05 | [Die Planeten-Berechnung](05-planeten/README.md) | Koordinaten, Tierkreis, Aspekte | JS | ● | | 2 h |
| 06 | [Datenbank und SQL](06-datenbank-sql/README.md) | Tabellen, Schlüssel, JOIN, SQL-Injection | JS + **Praxis (7 SQL-Aufgaben)** | ● | ● | 3 h |
| 07 | [Node-RED](07-node-red/README.md) | Flows, `msg`, Function-Nodes, unser Flow | JS + Hand (Editor) | ● | ○ | 2 h |
| 08 | [Grafana](08-grafana/README.md) | Datenquelle, Panels, Variablen, Rollen | JS + Hand (eigenes Panel) | ● | ● | 1,5 h |
| 09 | [Der Setup-Assistent](09-setup-assistent/README.md) | Admin-APIs, Auth, Sicherheit, `.exe` bauen | JS | ● | | 2 h |
| 10 | [Netzwerk und Fehlersuche](10-netzwerk-fehlersuche/README.md) | IP, Ports, Schichtenmodell, echte Fälle | JS + **Praxis (Fall-Quiz)** | ● | ● | 2 h |
| 11 | [Statistik](11-statistik/README.md) | Kontrollgruppe, χ², Nachbeben | JS | ● | ○ | 1 h |
| 12 | [Docker](12-docker/README.md) | Image, Container, Volume, compose.yaml | JS + **Praxis (Dockerfile)** | ● | ● | 2 h |
| 13 | [Git und GitHub](13-git-github/README.md) | Commits, Branches, `.gitignore`, Pull Requests | JS + **Praxis (eigenes Repository)** | ● | ● | 2 h |
| 14 | [Linux-Server betreiben](14-linux-server/README.md) | SSH, apt, systemctl, Logs, Rechte, Backup, cron | **Praxis (Quiz + Befehle)** + Hand | ○ | ● | 3 h |
| 15 | [Netzwerk-Praxis](15-netzwerk-praxis/README.md) | Subnetze, feste IP, DNS, Firewall mit ufw | **Praxis (Rechnen + Befehle)** + Hand | ○ | ● | 3 h |

● = Kern des Lernwegs · ○ = empfohlen zum Lesen / als Ergänzung

Zum Nachschlagen für den Unterricht: [Erklär-Spickzettel](spickzettel.md).

## So arbeitest du damit

1. Lies die Einheit (`README.md` im jeweiligen Ordner) von oben nach unten.
2. Mach die Übungen:
   - **JS:** In `uebung.js` die `TODO`s durch deinen Code ersetzen.
   - **Praxis:** In `antworten.txt`, `befehle.txt` oder `quiz.txt` deine Antwort hinter den Doppelpunkt schreiben,
     z. B. `port-grafana: 3000`. Leer gelassene Fragen zählen als „noch offen“, nicht als falsch.
3. Prüfe dich selbst, z. B.:
   ```
   node --test "lernen/14-linux-server/*.test.js"
   ```
   Grün ✔ = richtig, rot ✖ = schau dir die Meldung an (sie gibt meistens einen Tipp), ﹣ = noch offen.
4. Erst danach in die Musterlösung schauen (`loesung.js`, `loesung-*.txt`). Deine Lösung darf anders aussehen,
   solange die Tests grün sind.
5. Beantworte die **Selbsttest-Fragen** laut, als würdest du es jemandem erklären.

| Befehl | Prüft |
|---|---|
| `npm run lernen` | alle Übungen (FIAE) |
| `npm run lernen:fisi` | nur die Praxis-Übungen (FISI) |
| `LOESUNG=1 npm run lernen` | die Musterlösungen (zum Ausprobieren, ob alles funktioniert) |

## Zusammenhang

```
            Grundlagen (FIAE)                Fachteile entlang des Datenflusses
   ┌──────────────────────────┐
   │ 01 JavaScript            │      USGS ──► 07 Node-RED ──► 06 Datenbank ──► 08 Grafana
   │ 02 Module & npm          │ ───►            │ nutzt 03 HTTP, 04 async
   │ 03 HTTP                  │                 └ rechnet mit 05 Planeten
   │ 04 Asynchron             │                              │
   └──────────────────────────┘          09 Setup-Assistent richtet 06–08 automatisch ein
   00 Gesamtbild = Landkarte                                 │
                                         11 Statistik: Was bedeuten die Ergebnisse?

   Betrieb (FISI-Schwerpunkt, für alle nützlich):
   10 Fehlersuche ─► 15 Netzwerk-Praxis      12 Docker      14 Linux-Server      13 Git
```

**Reihenfolge FIAE:** 00 → 01 → 02 → 03 → 04 → 05 / 06 → 07 → 08 → 09 → 11, dazwischen 10 (nach 03), 12 und 13.
**Reihenfolge FISI:** 00 → 10 → 15 → 14 → 06 → 12 → 08 → 13, dazu 07 und 03 zum Lesen.

## Bezug zur Ausbildung

Vieles hier ist prüfungsrelevant. **FIAE:** Client-Server-Modell, HTTP, relationale Datenbanken und SQL,
Normalisierung, Testen, Sicherheit (SQL-Injection, Passwörter). **FISI:** IP-Adressierung und Subnetting,
Firewall und Netzwerksicherheit, Linux-Administration, Dienste, Datensicherung, Virtualisierung/Container.
**Beide:** Fehleranalyse und das Erklären technischer Zusammenhänge für Nicht-Fachleute. Die Selbsttest-Fragen
am Ende jeder Einheit sind im Stil von Prüfungsfragen formuliert.
