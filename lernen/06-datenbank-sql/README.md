# 06 – Datenbank und SQL

## Lernziele
- Du kannst das Datenmodell des Projekts als ER-Modell erklären (Tabellen, Schlüssel, Beziehungen).
- Du kannst SELECT-Abfragen mit WHERE, ORDER BY, GROUP BY und JOIN schreiben.
- Du kannst erklären, was SQL-Injection ist und wie Platzhalter (`?`) davor schützen.
- Du verstehst `INSERT IGNORE`, `REPLACE` und `UPDATE` im Node-RED-Flow.

---

## 1. Warum eine Datenbank?

Node-RED läuft ständig und sammelt. Wenn es neu startet, ist alles im Arbeitsspeicher weg.
Die Datenbank speichert **dauerhaft**, und Grafana kann sie mit SQL gezielt abfragen
(„wie viele Beben bei Vollmond?“), ohne alle Daten selbst durchsuchen zu müssen.

**MariaDB** ist ein Abzweig („Fork“) von MySQL und verhält sich fast identisch. Deshalb heißt der
Grafana-Datenquellen-Typ „MySQL“ und das npm-Paket `mysql2`, obwohl XAMPP und der Pi MariaDB benutzen.

## 2. Das Datenmodell

Die Tabellen stehen in [db/schema.sql](../../db/schema.sql).

```
┌──────────────────────────┐        ┌───────────────────────────┐
│ events                   │ 1    n │ body_positions            │
├──────────────────────────┤────────├───────────────────────────┤
│ PK id                    │        │ PK,FK event_id            │
│    kind (earthquake/     │        │ PK    body (Sun, Moon …)  │
│          control)        │        │       zodiac_sign         │
│ UQ source_id             │        │       altitude_deg …      │
│    time_utc, latitude,   │        └───────────────────────────┘
│    longitude, magnitude  │ 1    n ┌───────────────────────────┐
│    moon_phase_deg        │────────│ aspects                   │
│    sky_computed (0/1)    │        ├───────────────────────────┤
└──────────────────────────┘        │ PK,FK event_id            │
                                    │ PK    body_a, body_b,     │
                                    │       aspect              │
                                    │       orb_deg             │
                                    └───────────────────────────┘
```
| Begriff | Bedeutung | Im Projekt |
|---|---|---|
| **Primärschlüssel (PK)** | eindeutige Kennung jeder Zeile | `events.id`, automatisch hochgezählt (`AUTO_INCREMENT`) |
| **zusammengesetzter PK** | mehrere Spalten zusammen eindeutig | `(event_id, body)`: pro Event jeder Körper nur einmal |
| **UNIQUE** | Wert darf nur einmal vorkommen | `source_id` (USGS-ID): dasselbe Beben nie doppelt |
| **Fremdschlüssel (FK)** | verweist auf den PK einer anderen Tabelle | `body_positions.event_id → events.id` |
| **ON DELETE CASCADE** | wird das Event gelöscht, verschwinden seine Positionen mit | – |
| **Index (KEY)** | macht Suchen nach dieser Spalte schnell | `idx_kind_time`, `idx_body_sign` |

**Warum drei Tabellen statt einer?** Ein Event hat 10 Positionen und bis zu ~30 Aspekte. In einer Tabelle bräuchte
man entweder 160 Spalten (`sun_sign`, `moon_sign`, …) oder müsste Beben-Daten 10-mal wiederholen.
Getrennte Tabellen mit 1:n-Beziehung vermeiden Wiederholung: Das ist **Normalisierung**.

## 3. Daten schreiben (Node-RED)

| Befehl | Was er tut | Wo |
|---|---|---|
| `INSERT IGNORE INTO events …` | Einfügen. Gibt es die `source_id` schon, **still überspringen**. | [split-usgs.js](../../node-red/functions/split-usgs.js) |
| `REPLACE INTO body_positions …` | Gibt es den Schlüssel schon, alte Zeile löschen und neu einfügen | [compute-sky.js](../../node-red/functions/compute-sky.js) |
| `UPDATE events SET sky_computed = 1 WHERE id = ?` | Vorhandene Zeile ändern | compute-sky.js |

Weil USGS alle 5 Minuten die Beben der letzten 24 Stunden schickt, kommt jedes Beben ~288-mal an.
`INSERT IGNORE` + `UNIQUE` sorgen dafür, dass es trotzdem nur einmal gespeichert wird. Und weil mehrere
Schüler:innen in **dieselbe** Datenbank schreiben dürfen, schadet es auch nicht, wenn alle dasselbe Beben schicken.
Dass ein Befehl beliebig oft ausgeführt werden kann, ohne dass sich das Ergebnis ändert, heißt **idempotent**.

## 4. SQL-Injection und Platzhalter

**Falsch**, Werte direkt in den Text kleben:
```js
const sql = `SELECT * FROM events WHERE place = '${place}'`;
```
Wenn `place` = `x'; DROP TABLE events; --` ist, wird daraus:
```sql
SELECT * FROM events WHERE place = 'x'; DROP TABLE events; --'
```
→ Tabelle gelöscht. Die Werte kommen bei uns von USGS aus dem Internet, also **nicht vertrauenswürdig**.

**Richtig**, mit Platzhaltern:
```js
msg.topic   = 'INSERT IGNORE INTO events (kind, source_id, place) VALUES (?, ?, ?)';
msg.payload = ['earthquake', f.id, p.place];
```
Die Datenbank bekommt Befehl und Werte **getrennt**. Ein Wert kann nie zu einem Befehl werden.

Tabellen- und Spaltennamen können **keine** Platzhalter sein. Darum prüft [db.js](../../setup-wizard/lib/db.js)
den Datenbanknamen mit `/^[A-Za-z0-9_]{1,64}$/` (nur Buchstaben, Ziffern, `_`), bevor er in den Befehl kommt.

## 5. Abfragen (Grafana)

```sql
-- Grundform
SELECT place, magnitude FROM events WHERE kind = 'earthquake' AND magnitude >= 6 ORDER BY magnitude DESC LIMIT 5;

-- Zusammenfassen: eine Zeile pro Gruppe
SELECT FLOOR(magnitude) AS stufe, COUNT(*) AS anzahl FROM events WHERE kind = 'earthquake' GROUP BY stufe;

-- Verbinden: zu jedem Beben die Mond-Position
SELECT e.place, bp.zodiac_sign
FROM events e
JOIN body_positions bp ON bp.event_id = e.id AND bp.body = 'Moon'
WHERE e.kind = 'earthquake';
```
Ein Trick aus [queries.sql](../../grafana/queries.sql): In MariaDB ist ein Vergleich `1` (wahr) oder `0` (falsch).
`SUM(kind = 'earthquake')` zählt deshalb die Beben, `SUM(kind = 'control')` die Kontroll-Events, **in einer Abfrage**.

Und die **Fensterfunktion** `SUM(SUM(x)) OVER ()` rechnet die Gesamtsumme über alle Gruppen aus, damit man
Prozente bilden kann: Anteil der Gruppe = Gruppensumme / Gesamtsumme.

## 6. Selbst ausprobieren

In der Docker-Umgebung, mit dem Nur-Lesen-Benutzer `lernen`:
```
docker compose exec mariadb mariadb -u lernen -plernen planeten_erdbeben
```
Danach SQL eintippen, mit `;` abschließen. Beenden: `exit`.
(Mit XAMPP statt Docker: `mysql -h 127.0.0.1 -u <benutzer> -p planeten_erdbeben`, oder http://localhost/phpmyadmin.)
Nützlich: `SHOW TABLES;`, `DESCRIBE events;`, `SELECT * FROM events LIMIT 3;`

## Übung

1. **JavaScript:** [uebung.js](uebung.js). Prüfen: `node --test lernen/06-datenbank-sql/uebung.test.js`
2. **SQL:** [uebung.sql](uebung.sql). Schreibe die Abfragen unter jede Aufgabe. Prüfen:
   `node --test lernen/06-datenbank-sql/sql.test.js`
   Der Test führt deine Abfrage und die Musterlösung gegen die echte Datenbank aus und vergleicht
   die Ergebnisse. Er liest nur, er ändert nichts. Dafür muss die Docker-Umgebung laufen und mit Daten
   gefüllt sein (Backfill); den Zugang regelt [verbindung.js](../verbindung.js).

## So erklärst du es
> „Die Datenbank ist wie ein Aktenschrank mit drei Schubladen. In der ersten liegt eine Karteikarte pro Beben.
> In der zweiten liegen pro Beben zehn Karten, eine pro Planet, und jede trägt die Nummer ihres Bebens.
> So muss man die Beben-Daten nicht zehnmal abschreiben. Mit JOIN legt man die passenden Karten nebeneinander.“

## Wenn es nicht klappt

| Fehlermeldung | Ursache |
|---|---|
| `Access denied for user 'x'@'localhost'` | Benutzer oder Passwort falsch |
| `Access denied for user ''@'localhost'` | **Kein** Benutzer angegeben, Anmeldung als anonymer Gast |
| `Host 'x' is not allowed to connect` | Benutzer darf sich nur lokal anmelden, nicht übers Netz (`'name'@'%'` nötig) |
| `ECONNREFUSED …:3306` | MariaDB läuft nicht, oder hört nur auf 127.0.0.1 (`bind-address`, Einheit 10) |
| `Unknown column 'x' in 'field list'` | Spaltenname falsch geschrieben: `DESCRIBE tabelle;` |
| `… isn't in GROUP BY` | Spalte im SELECT, die weder gruppiert noch zusammengefasst (COUNT, SUM …) ist |
| `You have an error in your SQL syntax … near 'x'` | Schau direkt **vor** `x`: oft fehlt ein Komma oder ein Anführungszeichen |
| `Duplicate entry … for key` | Wert für einen UNIQUE/PK existiert schon. Bei uns gewollt verhindert durch `INSERT IGNORE` |

## Selbsttest-Fragen
1. Warum hat `body_positions` einen zusammengesetzten Primärschlüssel?
2. Was passiert, wenn Node-RED dasselbe Beben zweimal einfügt? Warum ist das gut?
3. Erkläre SQL-Injection an einem eigenen Beispiel und wie Platzhalter schützen.
4. Warum kann der Datenbankname im Setup-Assistenten nicht als `?`-Platzhalter übergeben werden?
5. Was ist der Unterschied zwischen `WHERE` und `HAVING`? (Tipp: [queries.sql](../../grafana/queries.sql), Abfrage 4)
