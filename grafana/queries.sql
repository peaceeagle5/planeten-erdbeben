-- Grafana panel queries (MySQL data source, set "Session timezone" to +00:00).
-- Dashboard variables to create (Settings > Variables, type "Custom"):
--   minmag : 4.5,5,6,7
--   body   : Sun,Moon,Mercury,Venus,Mars,Jupiter,Saturn,Uranus,Neptune,Pluto
--   orb    : 1,2,4,8
--   event  : type "Text box", hidden. Set by clicking a quake on the map (data link).
--            Empty = the latest quake. ${event:sqlstring} puts it in quotes and escapes it,
--            and CAST(... AS UNSIGNED) turns it into a number, so nothing typed into the URL
--            can change the SQL.
--
-- Every comparison shows quakes_pct next to control_pct. Only the DIFFERENCE matters:
-- the control events are the same places at random times, so they show what the
-- distribution looks like by chance alone.

-- =====================================================================
-- 1) Geomap panel: where the quakes happened (Format: Table)
--    event_id is used by the data link: click a quake -> var-event=<event_id>
-- =====================================================================
SELECT id AS event_id, time_utc AS time, latitude, longitude, magnitude, depth_km, place, moon_phase_deg
FROM events
WHERE kind = 'earthquake' AND $__timeFilter(time_utc) AND magnitude >= $minmag;

-- =====================================================================
-- 2) Bar chart: quakes vs. control by Moon phase (8 phases)
-- =====================================================================
SELECT ELT(bin + 1, 'New', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
                    'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent') AS phase,
       quakes_pct, control_pct
FROM (
  SELECT FLOOR(MOD(moon_phase_deg + 22.5, 360) / 45) AS bin,
         100 * SUM(kind = 'earthquake') / SUM(SUM(kind = 'earthquake')) OVER () AS quakes_pct,
         100 * SUM(kind = 'control')    / SUM(SUM(kind = 'control'))    OVER () AS control_pct
  FROM events
  WHERE sky_computed = 1 AND magnitude >= $minmag
  GROUP BY bin
) t
ORDER BY bin;

-- =====================================================================
-- 3) Bar chart: zodiac sign of the selected body ($body), quakes vs. control
-- =====================================================================
SELECT bp.zodiac_sign AS sign,
       100 * SUM(e.kind = 'earthquake') / SUM(SUM(e.kind = 'earthquake')) OVER () AS quakes_pct,
       100 * SUM(e.kind = 'control')    / SUM(SUM(e.kind = 'control'))    OVER () AS control_pct
FROM body_positions bp
JOIN events e ON e.id = bp.event_id
WHERE bp.body = '$body' AND e.magnitude >= $minmag
GROUP BY bp.zodiac_sign
ORDER BY FIELD(sign, 'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                     'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces');

-- =====================================================================
-- 4) Table: aspects that differ most between quakes and controls
--    pct = share of events that had this aspect within $orb degrees
-- =====================================================================
SELECT aspect, quakes_pct, control_pct, quakes_pct - control_pct AS diff_pct, n
FROM (
  SELECT CONCAT(a.body_a, ' ', a.aspect, ' ', a.body_b) AS aspect,
         100 * SUM(e.kind = 'earthquake') / (SELECT COUNT(*) FROM events
             WHERE kind = 'earthquake' AND sky_computed = 1 AND magnitude >= $minmag) AS quakes_pct,
         100 * SUM(e.kind = 'control') / (SELECT COUNT(*) FROM events
             WHERE kind = 'control' AND sky_computed = 1 AND magnitude >= $minmag) AS control_pct,
         COUNT(*) AS n
  FROM aspects a
  JOIN events e ON e.id = a.event_id
  WHERE e.magnitude >= $minmag AND a.orb_deg <= $orb
  GROUP BY a.body_a, a.aspect, a.body_b
  HAVING COUNT(*) >= 30
) t
ORDER BY ABS(diff_pct) DESC
LIMIT 20;

-- =====================================================================
-- 5) Bar chart: Moon above vs. below the horizon at the quake location
--    (tests a local effect rather than a global one)
-- =====================================================================
SELECT IF(bp.above_horizon, 'Moon above horizon', 'Moon below horizon') AS moon,
       100 * SUM(e.kind = 'earthquake') / SUM(SUM(e.kind = 'earthquake')) OVER () AS quakes_pct,
       100 * SUM(e.kind = 'control')    / SUM(SUM(e.kind = 'control'))    OVER () AS control_pct
FROM body_positions bp
JOIN events e ON e.id = bp.event_id
WHERE bp.body = 'Moon' AND e.magnitude >= $minmag
GROUP BY bp.above_horizon;

-- =====================================================================
-- 6) Canvas panel: the selected quake (latest if none) and its sky (one wide row;
--    bind Canvas text elements to these field names)
-- =====================================================================
SELECT IF(${event:sqlstring} = '', 'Latest earthquake', 'Selected earthquake') AS selection,
  e.time_utc, e.place, e.magnitude, e.depth_km, ROUND(e.moon_phase_deg, 1) AS moon_phase_deg,
  MAX(CASE WHEN bp.body = 'Sun'     THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°') END) AS Sun,
  MAX(CASE WHEN bp.body = 'Moon'    THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°') END) AS Moon,
  MAX(CASE WHEN bp.body = 'Mercury' THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Mercury,
  MAX(CASE WHEN bp.body = 'Venus'   THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Venus,
  MAX(CASE WHEN bp.body = 'Mars'    THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Mars,
  MAX(CASE WHEN bp.body = 'Jupiter' THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Jupiter,
  MAX(CASE WHEN bp.body = 'Saturn'  THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Saturn,
  MAX(CASE WHEN bp.body = 'Uranus'  THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Uranus,
  MAX(CASE WHEN bp.body = 'Neptune' THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Neptune,
  MAX(CASE WHEN bp.body = 'Pluto'   THEN CONCAT(bp.zodiac_sign, ' ', ROUND(bp.degree_in_sign, 1), '°', IF(bp.retrograde, ' R', '')) END) AS Pluto
FROM events e
JOIN body_positions bp ON bp.event_id = e.id
WHERE e.id = IF(${event:sqlstring} = '',
              (SELECT id FROM events WHERE kind = 'earthquake' AND sky_computed = 1
               ORDER BY time_utc DESC LIMIT 1),
              CAST(${event:sqlstring} AS UNSIGNED))
GROUP BY e.id;

-- =====================================================================
-- 7) Stat panel: pipeline health
-- =====================================================================
SELECT SUM(kind = 'earthquake') AS quakes, SUM(kind = 'control') AS controls,
       SUM(sky_computed = 0) AS pending
FROM events;

-- =====================================================================
-- 8) Geomap panel, second query (refId B): tectonic plate boundaries
--    (points of the plate outlines, drawn as small dots under the quakes)
-- =====================================================================
SELECT latitude, longitude, code AS plate
FROM plate_points;

-- =====================================================================
-- 9) Bar chart: earthquakes per tectonic plate (time range, M >= $minmag)
--    ST_Contains finds the plate whose outline contains the quake.
--    IGNORE INDEX: with the spatial index MariaDB 11.8 sometimes fails ("Update locks cannot be
--    acquired during a READ UNCOMMITTED transaction", e.g. at M >= 7). 52 plates need no index.
-- =====================================================================
SELECT p.name AS plate, COUNT(*) AS quakes
FROM events e
JOIN plates p IGNORE INDEX (sp_geom) ON ST_Contains(p.geom, POINT(e.longitude, e.latitude))
WHERE e.kind = 'earthquake' AND $__timeFilter(e.time_utc) AND e.magnitude >= $minmag
GROUP BY p.code, p.name
ORDER BY quakes DESC
LIMIT 15;

-- =====================================================================
-- 10) Geomap panel, third query (refId C): ring around the quake shown in the sky panel
--     (same selection as query 6: the clicked quake, or the latest one)
-- =====================================================================
SELECT latitude, longitude, place
FROM events
WHERE id = IF(${event:sqlstring} = '',
              (SELECT id FROM events WHERE kind = 'earthquake' AND sky_computed = 1
               ORDER BY time_utc DESC LIMIT 1),
              CAST(${event:sqlstring} AS UNSIGNED));

-- =====================================================================
-- 11) Business Charts panel (refId A): the solar system at the selected quake, seen from above
--     lon = heliocentric ecliptic longitude, dist = distance from the Sun (AU).
--     The Earth has no row of its own: seen from the Sun it stands opposite the Sun
--     (longitude + 180°, same distance). Drawn by grafana/solar-system.echarts.js.
-- =====================================================================
SELECT body, helio_lon_deg AS lon, helio_dist_au AS dist
FROM body_positions
WHERE event_id = IF(${event:sqlstring} = '',
              (SELECT id FROM events WHERE kind = 'earthquake' AND sky_computed = 1
               ORDER BY time_utc DESC LIMIT 1),
              CAST(${event:sqlstring} AS UNSIGNED))
  AND body NOT IN ('Sun', 'Moon') AND helio_dist_au IS NOT NULL
UNION ALL
SELECT 'Earth', MOD(ecl_lon_deg + 180, 360), distance_au
FROM body_positions
WHERE event_id = IF(${event:sqlstring} = '',
              (SELECT id FROM events WHERE kind = 'earthquake' AND sky_computed = 1
               ORDER BY time_utc DESC LIMIT 1),
              CAST(${event:sqlstring} AS UNSIGNED))
  AND body = 'Sun';

-- =====================================================================
-- 12) Business Charts panel, second query (refId B): title of the solar system chart
-- =====================================================================
SELECT time_utc AS time, place, magnitude
FROM events
WHERE id = IF(${event:sqlstring} = '',
              (SELECT id FROM events WHERE kind = 'earthquake' AND sky_computed = 1
               ORDER BY time_utc DESC LIMIT 1),
              CAST(${event:sqlstring} AS UNSIGNED));

-- =====================================================================
-- 13) Correlation finder (bar chart + table): is a Moon position more common at quakes than at controls?
--     $metric: moon-phase (0 = new, 180 = full), moon-altitude (height above the quake region),
--              moon-distance (5 groups, nearest to farthest).  $step: bin size in degrees.
--     $aftershocks: main = drop a quake if a stronger one was within 3 days and 300 km (as in
--     src/correlation.js), keep = all quakes. Only the Moon: the controls lie in the 2 years before each
--     quake, which is fair only for things that repeat many times in that time (tools/korrelation.js).
--     diff_pct = how many % more (or fewer) quakes than chance. z = distance from chance in standard
--     errors: |z| >= 2 happens by chance in 1 of 20 bins, |z| >= 3 in 1 of 370.
--     The time picker selects the quakes: find an effect in one year, check it in another.
-- =====================================================================
WITH quakes AS (
  SELECT e.source_id
  FROM events e
  WHERE e.kind = 'earthquake' AND e.sky_computed = 1 AND e.magnitude >= $minmag AND $__timeFilter(e.time_utc)
    AND (${aftershocks:sqlstring} = 'keep' OR NOT EXISTS (
      SELECT 1 FROM events s
      WHERE s.kind = 'earthquake' AND s.id <> e.id
        AND (s.magnitude > e.magnitude OR (s.magnitude = e.magnitude AND s.time_utc < e.time_utc))
        AND s.time_utc BETWEEN e.time_utc - INTERVAL 3 DAY AND e.time_utc + INTERVAL 3 DAY
        AND ST_Distance_Sphere(POINT(s.longitude, s.latitude), POINT(e.longitude, e.latitude)) <= 300000))
),
vals AS (
  SELECT e.kind,
         CASE ${metric:sqlstring}
           WHEN 'moon-phase' THEN e.moon_phase_deg
           WHEN 'moon-altitude' THEN m.altitude_deg
           ELSE m.distance_au
         END AS v
  FROM events e
  JOIN quakes q ON q.source_id = IF(e.kind = 'earthquake', e.source_id, e.paired_with)
  JOIN body_positions m ON m.event_id = e.id AND m.body = 'Moon'
  WHERE e.sky_computed = 1
),
edges AS (
  -- distance groups: the 5 fifths of the CONTROL events (how close the Moon is by chance)
  SELECT MAX(CASE WHEN t = 1 THEN v END) AS e1, MAX(CASE WHEN t = 2 THEN v END) AS e2,
         MAX(CASE WHEN t = 3 THEN v END) AS e3, MAX(CASE WHEN t = 4 THEN v END) AS e4
  FROM (SELECT v, NTILE(5) OVER (ORDER BY v) AS t FROM vals WHERE kind = 'control' AND v IS NOT NULL) ctl
),
binned AS (
  SELECT kind,
         CASE ${metric:sqlstring}
           WHEN 'moon-phase' THEN LEAST(FLOOR(v / CAST(${step:sqlstring} AS UNSIGNED)), CEIL(360 / CAST(${step:sqlstring} AS UNSIGNED)) - 1)
           WHEN 'moon-altitude' THEN LEAST(FLOOR((v + 90) / CAST(${step:sqlstring} AS UNSIGNED)), CEIL(180 / CAST(${step:sqlstring} AS UNSIGNED)) - 1)
           ELSE CASE WHEN v <= e1 THEN 0 WHEN v <= e2 THEN 1 WHEN v <= e3 THEN 2 WHEN v <= e4 THEN 3 ELSE 4 END
         END AS bin
  FROM vals CROSS JOIN edges
  WHERE v IS NOT NULL
),
counts AS (
  SELECT bin, SUM(kind = 'earthquake') AS q, SUM(kind = 'control') AS c
  FROM binned GROUP BY bin
),
shares AS (
  SELECT bin, q, c, q / SUM(q) OVER () AS qs, c / SUM(c) OVER () AS cs,
         (q + c) / (SUM(q) OVER () + SUM(c) OVER ()) AS pooled, SUM(q) OVER () AS nq, SUM(c) OVER () AS nc
  FROM counts
)
SELECT CASE ${metric:sqlstring}
         WHEN 'moon-phase' THEN CONCAT(bin * CAST(${step:sqlstring} AS UNSIGNED), '…', LEAST(360, (bin + 1) * CAST(${step:sqlstring} AS UNSIGNED)), '°')
         WHEN 'moon-altitude' THEN CONCAT(bin * CAST(${step:sqlstring} AS UNSIGNED) - 90, '…', LEAST(90, (bin + 1) * CAST(${step:sqlstring} AS UNSIGNED) - 90), '°')
         ELSE ELT(bin + 1, 'nearest 20 %', '20–40 %', '40–60 %', '60–80 %', 'farthest 20 %')
       END AS bin,
       100 * qs AS quakes_pct,
       100 * cs AS control_pct,
       100 * (qs / cs - 1) AS diff_pct,
       q AS quakes,
       (qs - cs) / SQRT(pooled * (1 - pooled) * (1 / nq + 1 / nc)) AS z
FROM shares
ORDER BY shares.bin;
