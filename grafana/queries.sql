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
