-- Einheit 06 – SQL-Übungen auf der echten Datenbank planeten_erdbeben
-- Schreibe deine Abfrage unter die Aufgabe (ohne -- davor). Aufgaben ohne Abfrage werden übersprungen.
-- Prüfen: node --test lernen/06-datenbank-sql/sql-praxis.test.js
-- Die Spaltennamen sind egal, verglichen werden die Werte und ihre Reihenfolge.

-- Aufgabe 1: Wie viele echte Erdbeben (kind = 'earthquake') sind gespeichert?
--            Ergebnis: eine Zahl.


-- Aufgabe 2: Die 5 stärksten Erdbeben: place, magnitude.
--            Sortiert nach magnitude absteigend, bei Gleichstand nach time_utc aufsteigend.


-- Aufgabe 3: Wie viele Erdbeben gibt es pro ganzer Magnitude-Stufe (4, 5, 6, 7 …)?
--            Spalten: Stufe, Anzahl. Sortiert nach Stufe. Tipp: FLOOR(magnitude), GROUP BY


-- Aufgabe 4: Für das stärkste Erdbeben (das erste aus Aufgabe 2): jeder Himmelskörper mit Tierkreiszeichen.
--            Spalten: body, zodiac_sign. Sortiert nach body. Tipp: JOIN body_positions, Unterabfrage für die id


-- Aufgabe 5: In welchem Tierkreiszeichen stand der Mond wie oft bei echten Erdbeben?
--            Spalten: zodiac_sign, Anzahl. Sortiert nach Anzahl absteigend, dann zodiac_sign.


-- Aufgabe 6: Wie viel Prozent der Erdbeben und wie viel Prozent der Kontroll-Events hatten den Mond
--            über dem Horizont (above_horizon = 1)?
--            Ergebnis: eine Zeile, zwei Zahlen (Beben-Prozent, Kontroll-Prozent), auf 1 Stelle gerundet.
--            Tipp: SUM(bp.above_horizon AND e.kind = 'earthquake') / SUM(e.kind = 'earthquake')


-- Aufgabe 7: Die 5 häufigsten Aspekte bei echten Erdbeben.
--            Spalten: body_a, aspect, body_b, Anzahl.
--            Sortiert nach Anzahl absteigend, dann body_a, body_b, aspect. Tipp: aspects JOIN events
