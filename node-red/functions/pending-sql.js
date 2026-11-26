// Builds the query for events that still need their sky computed (sky_computed = 0).
// The table comes from the tab's environment variable TABLE_PREFIX (double-click the tab),
// e.g. "anna_" -> anna_events. So an imported flow works after setting the prefix there.
// time_iso: the time as an ISO string with milliseconds, in UTC (the database session runs in UTC).
const T = env.get('TABLE_PREFIX') || '';
msg.topic = 'SELECT id, latitude, longitude, ' +
  "CONCAT(DATE_FORMAT(time_utc, '%Y-%m-%dT%H:%i:%s.'), LPAD(FLOOR(MICROSECOND(time_utc) / 1000), 3, '0'), 'Z') AS time_iso " +
  `FROM ${T}events WHERE sky_computed = 0 ORDER BY id LIMIT 600`;
msg.payload = [];
return msg;
