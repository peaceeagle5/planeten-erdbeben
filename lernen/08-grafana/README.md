# 08 – Grafana

## Lernziele
- Du kannst Datenquelle, Dashboard, Panel und Abfrage unterscheiden.
- Du verstehst Variablen (`$minmag`, `$body`) und Makros (`$__timeFilter`).
- Du kannst selbst ein Panel mit eigener SQL-Abfrage anlegen.
- Du kannst die Rollen Viewer, Editor und Admin erklären.

---

## 1. Die Begriffe

```
Grafana
 ├─ Datenquelle "Planeten-Erdbeben (planeten_erdbeben)"   ← WIE kommt Grafana an die Daten? (Host, Port, Login)
 └─ Dashboard "Planeten & Erdbeben (Pascal)"               ← eine Seite
     ├─ Panel "Pipeline"            (Stat)       ┐
     ├─ Panel "Sky at the latest…"  (Canvas)     │  jedes Panel = eine SQL-Abfrage + eine Darstellung
     ├─ Panel "Earthquakes"         (Geomap)     │
     └─ Panel "Moon phase …"        (Bar chart)  ┘
```
| Begriff | Was |
|---|---|
| **Datenquelle** | Verbindung zu einer Datenbank. Einmal angelegt, von vielen Dashboards benutzt. Das Passwort liegt verschlüsselt in Grafana. |
| **Dashboard** | Eine Seite mit Panels, Zeitbereich und Variablen. Intern ein großes JSON-Objekt. |
| **Panel** | Ein Kästchen: Abfrage + Darstellung (Tabelle, Balken, Karte, Zahl, Canvas …) |
| **Abfrage (Query)** | Das SQL, das Grafana bei jedem Laden des Panels an die Datenbank schickt |

Grafana speichert **keine** Erdbeben-Daten. Es fragt jedes Mal neu bei der Datenbank nach.

## 2. Variablen

Oben im Dashboard sind Auswahlfelder (Min. magnitude, Body, Aspect orb). In den Abfragen stehen dafür Platzhalter:
```sql
WHERE bp.body = '$body' AND e.magnitude >= $minmag
```
Bevor Grafana die Abfrage abschickt, ersetzt es `$body` durch die Auswahl, z. B. `Moon`.
Das ist einfaches **Text-Ersetzen**. Darum stehen um `'$body'` Anführungszeichen (es ist ein Text) und um `$minmag` nicht.

`$ds` ist eine besondere Variable vom Typ „Datenquelle“: Damit kann man dasselbe Dashboard mit einer anderen
Datenbank benutzen.

## 3. Makros und Zeit

`$__timeFilter(time_utc)` ist ein **Makro**: Grafana ersetzt es durch den oben rechts gewählten Zeitbereich:
```sql
time_utc BETWEEN '2024-11-19 00:00:00' AND '2026-11-19 23:59:59'
```
Damit das stimmt, sind **alle** Zeiten in UTC: in der Datenbank, in der Datenquelle (Session timezone `+00:00`)
und im Dashboard (`timezone: 'utc'`). Wenn ein Teil davon lokale Zeit benutzt, verschieben sich Daten um
1–2 Stunden.

Die Vergleichsdiagramme benutzen den Zeitbereich absichtlich **nicht**: Kontroll-Events haben zufällige Zeiten
und würden sonst teilweise herausgefiltert.

## 4. Wie das Dashboard entsteht

Niemand klickt die 7 Panels von Hand zusammen. [dashboard-builder.js](../../grafana/dashboard-builder.js):
1. liest [queries.sql](../../grafana/queries.sql) und zerlegt sie an den Überschriften `-- 1) …`, `-- 2) …`,
2. baut daraus das Dashboard-JSON (Panels, Farben, Variablen),
3. schickt es per `POST /api/dashboards/db` an Grafana (mit `overwrite: true`).

Vorteil: Eine Änderung in `queries.sql` + Assistent erneut ausführen = alle Dashboards aktualisiert.
Nachteil: Änderungen, die du **in Grafana** von Hand machst, werden beim nächsten Setup überschrieben.

## 5. Rollen

| Rolle | darf |
|---|---|
| **Viewer** | Dashboards ansehen |
| **Editor** | zusätzlich Dashboards anlegen und ändern |
| **Admin** | zusätzlich Datenquellen und Benutzer verwalten |

Deshalb legt im Unterricht die Lehrkraft (Admin) einmal die Datenquelle an, und Schüler:innen (Editor) wählen sie
im Setup-Assistenten aus. Sie brauchen dann **nicht** das Datenbank-Passwort für Grafana.

## Übung

1. **JavaScript:** [uebung.js](uebung.js), Grafanas Ersetzungen nachbauen. Prüfen: `node --test lernen/08-grafana/`
2. **In Grafana** (http://127.0.0.1:3000): Öffne dein Dashboard → **Edit** → **Add → Visualization**.
   - Datenquelle: Planeten-Erdbeben. Oben auf **Code** umschalten, Format **Table**.
   - Aufgabe A, Typ „Time series“: Beben pro Tag.
     ```sql
     SELECT DATE(time_utc) AS time, COUNT(*) AS beben
     FROM events WHERE kind = 'earthquake' AND $__timeFilter(time_utc)
     GROUP BY DATE(time_utc) ORDER BY time
     ```
   - Aufgabe B, Typ „Stat“: durchschnittliche Tiefe der Beben ab `$minmag`. Schreibe das SQL selbst.
   - Aufgabe C: Ändere oben die Variable „Min. magnitude“ und beobachte, welche Panels sich ändern. Warum nicht alle?
   - Speichern. (Denk dran: Das Setup überschreibt das Dashboard beim nächsten Lauf.
     Für Dauerhaftes: **Save as** mit neuem Namen.)

## So erklärst du es
> „Grafana ist ein Bildschirm, kein Speicher. Jedes Kästchen schickt beim Öffnen eine Frage an die Datenbank
> und malt die Antwort. Die Auswahlfelder oben ändern nur Wörter in diesen Fragen, zum Beispiel ‚Mond‘ statt
> ‚Sonne‘.“

## Wenn es nicht klappt

| Beobachtung | Ursache |
|---|---|
| Panel zeigt „No data“ | Abfrage liefert 0 Zeilen: Zeitbereich zu klein? Variable zu streng? SQL in Einheit 06 testen |
| Rotes Dreieck oben links im Panel | SQL-Fehler: draufzeigen, Meldung lesen |
| „Data source connected, but no data“ / „db query error“ | Datenbank erreichbar, aber Tabelle/Spalte falsch oder kein Recht |
| Datenquelle testen: „dial tcp …:3306: connect: connection refused“ | Grafana erreicht die Datenbank nicht. Adresse **aus Sicht des Grafana-Servers** prüfen (Einheit 10) |
| Daten um 1–2 Stunden verschoben | Zeitzone nicht überall UTC |
| Geomap leer, obwohl Tabelle Daten hat | Spalten `latitude`/`longitude` fehlen oder heißen anders |
| „Permission denied“ beim Speichern | Konto ist nur Viewer |

## Selbsttest-Fragen
1. Warum stehen um `$body` Anführungszeichen, um `$minmag` aber nicht?
2. Was passiert, wenn du in Grafana ein Panel änderst und danach den Setup-Assistenten erneut ausführst?
3. Warum braucht ein Editor kein Datenbank-Passwort?
4. Was ist der Unterschied zwischen einer Variablen und einem Makro?
