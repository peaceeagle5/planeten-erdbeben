-- Einheit 06 – Musterlösungen

-- Aufgabe 1: Wie viele echte Erdbeben?
SELECT COUNT(*) AS anzahl FROM events WHERE kind = 'earthquake';

-- Aufgabe 2: Die 5 stärksten Erdbeben
SELECT place, magnitude
FROM events
WHERE kind = 'earthquake'
ORDER BY magnitude DESC, time_utc ASC
LIMIT 5;

-- Aufgabe 3: Anzahl pro Magnitude-Stufe
SELECT FLOOR(magnitude) AS stufe, COUNT(*) AS anzahl
FROM events
WHERE kind = 'earthquake'
GROUP BY stufe
ORDER BY stufe;

-- Aufgabe 4: Himmel beim stärksten Erdbeben
SELECT bp.body, bp.zodiac_sign
FROM body_positions bp
WHERE bp.event_id = (
  SELECT id FROM events WHERE kind = 'earthquake' ORDER BY magnitude DESC, time_utc ASC LIMIT 1
)
ORDER BY bp.body;

-- Aufgabe 5: Tierkreiszeichen des Mondes bei Erdbeben
SELECT bp.zodiac_sign, COUNT(*) AS anzahl
FROM events e
JOIN body_positions bp ON bp.event_id = e.id AND bp.body = 'Moon'
WHERE e.kind = 'earthquake'
GROUP BY bp.zodiac_sign
ORDER BY anzahl DESC, bp.zodiac_sign;

-- Aufgabe 6: Mond über dem Horizont, Beben vs. Kontrolle
SELECT
  ROUND(100 * SUM(bp.above_horizon AND e.kind = 'earthquake') / SUM(e.kind = 'earthquake'), 1) AS beben_pct,
  ROUND(100 * SUM(bp.above_horizon AND e.kind = 'control') / SUM(e.kind = 'control'), 1) AS kontrolle_pct
FROM events e
JOIN body_positions bp ON bp.event_id = e.id AND bp.body = 'Moon';

-- Aufgabe 7: Die 5 häufigsten Aspekte bei Erdbeben
SELECT a.body_a, a.aspect, a.body_b, COUNT(*) AS anzahl
FROM aspects a
JOIN events e ON e.id = a.event_id
WHERE e.kind = 'earthquake'
GROUP BY a.body_a, a.aspect, a.body_b
ORDER BY anzahl DESC, a.body_a, a.body_b, a.aspect
LIMIT 5;
