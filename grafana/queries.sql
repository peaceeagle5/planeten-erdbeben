-- Grafana panel queries (MySQL data source, set "Session timezone" to +00:00).
-- Dashboard variables to create (Settings > Variables, type "Custom"):
--   minmag : 4.5,5,6,7
--   body   : Sun,Moon,Mercury,Venus,Mars,Jupiter,Saturn,Uranus,Neptune,Pluto
--   orb    : 1,2,4,8
--
-- Every comparison shows quakes_pct next to control_pct. Only the DIFFERENCE matters:
-- the control events are the same places at random times, so they show what the
-- distribution looks like by chance alone.

-- =====================================================================
-- 1) Geomap panel: where the quakes happened (Format: Table)
-- =====================================================================
SELECT time_utc AS time, latitude, longitude, magnitude, depth_km, place, moon_phase_deg
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
-- 6) Canvas panel: the latest quake and its sky (one wide row;
--    bind Canvas text elements to these field names)
-- =====================================================================
SELECT e.time_utc, e.place, e.magnitude, e.depth_km, ROUND(e.moon_phase_deg, 1) AS moon_phase_deg,
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
WHERE e.id = (SELECT id FROM events WHERE kind = 'earthquake' AND sky_computed = 1
              ORDER BY time_utc DESC LIMIT 1)
GROUP BY e.id;

-- =====================================================================
-- 7) Stat panel: pipeline health
-- =====================================================================
SELECT SUM(kind = 'earthquake') AS quakes, SUM(kind = 'control') AS controls,
       SUM(sky_computed = 0) AS pending
FROM events;
