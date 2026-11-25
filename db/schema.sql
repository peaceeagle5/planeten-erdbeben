-- Planets & earthquakes schema (MySQL 8+). All times are stored in UTC.
-- The setup wizard gives every person their own copy of events, body_positions and aspects, with a
-- name prefix (anna_events, ...; see shared/tables.js). plates and plate_points are shared.
CREATE DATABASE IF NOT EXISTS planeten_erdbeben CHARACTER SET utf8mb4;
USE planeten_erdbeben;

-- One row per moment+place we computed the sky for.
--   kind = 'earthquake': a real quake (from USGS)
--   kind = 'control'   : same place as a quake, but a random time -> statistical baseline
CREATE TABLE IF NOT EXISTS events (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind           ENUM('earthquake','control') NOT NULL,
  source_id      VARCHAR(64)  NOT NULL,          -- USGS id, or 'ctrl-<USGS id>'
  paired_with    VARCHAR(64)  NULL,              -- for controls: the quake's source_id
  time_utc       DATETIME(3)  NOT NULL,
  latitude       DOUBLE       NOT NULL,
  longitude      DOUBLE       NOT NULL,
  depth_km       DOUBLE       NULL,
  magnitude      DOUBLE       NULL,              -- for controls: magnitude of the paired quake
  place          VARCHAR(255) NULL,
  moon_phase_deg DOUBLE       NULL,              -- 0 new, 90 first qtr, 180 full, 270 last qtr
  sky_computed   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_source (source_id),
  KEY idx_kind_time (kind, time_utc),
  KEY idx_magnitude (magnitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Position of every body (Sun, Moon, Mercury..Pluto) at each event.
CREATE TABLE IF NOT EXISTS body_positions (
  event_id        INT UNSIGNED NOT NULL,
  body            VARCHAR(16)  NOT NULL,
  ra_hours        DOUBLE       NOT NULL,   -- topocentric, equator of date
  dec_deg         DOUBLE       NOT NULL,
  distance_au     DOUBLE       NOT NULL,
  azimuth_deg     DOUBLE       NOT NULL,   -- as seen from the quake location
  altitude_deg    DOUBLE       NOT NULL,
  above_horizon   TINYINT(1)   NOT NULL,
  ecl_lon_deg     DOUBLE       NOT NULL,   -- geocentric ecliptic longitude
  ecl_lat_deg     DOUBLE       NOT NULL,
  zodiac_sign     VARCHAR(16)  NOT NULL,
  degree_in_sign  DOUBLE       NOT NULL,
  constellation   VARCHAR(32)  NOT NULL,   -- IAU constellation
  vis_magnitude   DOUBLE       NULL,
  phase_fraction  DOUBLE       NULL,
  retrograde      TINYINT(1)   NOT NULL,
  PRIMARY KEY (event_id, body),
  KEY idx_body_sign (body, zodiac_sign),
  CONSTRAINT fk_pos_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Aspects between pairs of bodies at each event (orb up to 8 deg).
CREATE TABLE IF NOT EXISTS aspects (
  event_id       INT UNSIGNED NOT NULL,
  body_a         VARCHAR(16)  NOT NULL,
  body_b         VARCHAR(16)  NOT NULL,
  aspect         VARCHAR(16)  NOT NULL,
  separation_deg DOUBLE       NOT NULL,
  orb_deg        DOUBLE       NOT NULL,
  PRIMARY KEY (event_id, body_a, body_b, aspect),
  KEY idx_aspect (body_a, body_b, aspect),
  CONSTRAINT fk_asp_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tectonic plates (Bird 2002, "PB2002"), loaded by Node-RED from GitHub.
-- geom: outline as MULTIPOLYGON with X = longitude, Y = latitude (SRID 0, plain lon/lat plane),
-- so SQL can ask "which plate is this quake on?":  ST_Contains(geom, POINT(longitude, latitude))
CREATE TABLE IF NOT EXISTS plates (
  code        VARCHAR(4)   NOT NULL PRIMARY KEY,   -- e.g. 'PA' = Pacific
  name        VARCHAR(64)  NOT NULL,
  geom        GEOMETRY     NOT NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  SPATIAL KEY sp_geom (geom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- The same outlines as single points, for drawing the plate boundaries on the Grafana map.
--   part = number of the ring (a plate can consist of several pieces), seq = position in the ring
CREATE TABLE IF NOT EXISTS plate_points (
  code       VARCHAR(4)        NOT NULL,
  part       SMALLINT UNSIGNED NOT NULL,
  seq        SMALLINT UNSIGNED NOT NULL,
  latitude   DOUBLE            NOT NULL,
  longitude  DOUBLE            NOT NULL,
  PRIMARY KEY (code, part, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Optional: a read-only user for Grafana
-- CREATE USER 'grafana'@'%' IDENTIFIED BY 'change-me';
-- GRANT SELECT ON planeten_erdbeben.* TO 'grafana'@'%';
