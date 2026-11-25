// Tests for the dashboard builder: node --test grafana/
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDashboard } = require('./dashboard-builder');

const d = buildDashboard({ uid: 'pe-anna', tablePrefix: 'anna_' });
const panel = (type) => d.panels.find((p) => p.type === type);

test('hidden $event variable, empty = latest quake', () => {
  const v = d.templating.list.find((x) => x.name === 'event');
  assert.equal(v.type, 'textbox');
  assert.equal(v.hide, 2);
  assert.equal(v.current.value, '');
});

test('sky panel and map ring use the selected quake, safely quoted', () => {
  const sky = panel('canvas').targets[0].rawSql;
  const ring = panel('geomap').targets.find((t) => t.refId === 'C').rawSql;
  for (const sql of [sky, ring]) {
    assert.match(sql, /IF\(\$\{event:sqlstring\} = ''/);
    assert.match(sql, /CAST\(\$\{event:sqlstring\} AS UNSIGNED\)/);
    assert.doesNotMatch(sql, /'\$event'|[^{]\$event\b/, 'never the raw $event');
    assert.match(sql, /anna_events/);
  }
});

test('map: quake id in the query, data link sets var-event and keeps the other choices', () => {
  const map = panel('geomap');
  assert.match(map.targets[0].rawSql, /^SELECT id AS event_id,/);
  const [link] = map.fieldConfig.defaults.links;
  assert.match(link.url, /^\/d\/\$\{__dashboard\.uid\}\?var-event=\$\{__data\.fields\.event_id\}/);
  for (const v of ['ds', 'minmag', 'body', 'orb']) assert.ok(link.url.includes(`\${${v}:queryparam}`), v);
  assert.ok(link.url.includes('${__url_time_range}'));
  assert.deepEqual(map.options.layers.map((l) => l.filterData.options), ['B', 'A', 'C']);
});

test('"Latest quake" link clears $event on this person\'s dashboard', () => {
  const [link] = d.links;
  assert.match(link.url, /^\/d\/pe-anna\?var-event=&/);
  assert.equal(link.keepTime, true);
});

test('solar system panel: Business Charts with planets (A) and title (B) for the selected quake', () => {
  const p = d.panels.find((x) => x.type === 'volkovlabs-echarts-panel');
  assert.ok(p, 'panel exists');
  assert.deepEqual(p.targets.map((t) => t.refId), ['A', 'B']);
  const [planets, title] = p.targets.map((t) => t.rawSql);
  assert.match(planets, /helio_lon_deg AS lon, helio_dist_au AS dist/);
  assert.match(planets, /UNION ALL\s+SELECT 'Earth', MOD\(ecl_lon_deg \+ 180, 360\), distance_au/);
  assert.match(planets, /FROM anna_body_positions/);
  for (const sql of [planets, title]) assert.match(sql, /CAST\(\$\{event:sqlstring\} AS UNSIGNED\)/);
  assert.equal(p.options.editorMode, 'code');
  assert.equal(p.options.getOption, require('node:fs').readFileSync(require.resolve('./solar-system.echarts.js'), 'utf8'));
});

/** Runs grafana/solar-system.echarts.js like Business Charts does: new Function('context', code). */
function runSolarCode(rows, quake, body) {
  const field = (name, values) => ({ name, values });
  const series = [
    { refId: 'A', fields: [field('body', rows.map((r) => r[0])), field('lon', rows.map((r) => r[1])), field('dist', rows.map((r) => r[2]))] },
    { refId: 'B', fields: [field('time', [quake.time]), field('place', [quake.place]), field('magnitude', [quake.magnitude])] },
  ];
  const handlers = {};
  const context = {
    panel: { data: { series }, chart: { off() {}, on: (ev, fn) => { handlers[ev] = fn; } } },
    grafana: {
      theme: { isDark: true, colors: { text: { primary: '#fff', secondary: '#aaa' } } },
      replaceVariables: (s) => s.replace('$body', body),
      locationService: { partial: (q) => { handlers.lastPartial = q; } },
    },
  };
  const option = new Function('context', d.panels.find((x) => x.type === 'volkovlabs-echarts-panel').options.getOption)(context);
  return { option, handlers };
}

const ROWS = [['Mercury', 158.2, 0.358], ['Venus', 81.0, 0.720], ['Mars', 111.8, 1.618], ['Jupiter', 135.8, 5.324],
  ['Saturn', 13.0, 9.418], ['Uranus', 63.7, 19.43], ['Neptune', 3.4, 29.88], ['Pluto', 304.8, 35.65], ['Earth', 62.2, 0.987]];
const QUAKE = { time: Date.UTC(2026, 10, 24, 11, 6), place: 'Mauritius - Reunion region', magnitude: 6.4 };

test('solar system code: one point per planet, each on its own ring, line of sight to $body', () => {
  const { option, handlers } = runSolarCode(ROWS, QUAKE, 'Jupiter');
  const planets = option.series.find((s) => s.name === 'Planets').data;
  assert.equal(planets.length, 9);
  const radius = Object.fromEntries(planets.map((p) => [p.name, p.value[0]]));
  assert.ok(radius.Mercury < radius.Venus && radius.Venus < radius.Earth && radius.Earth < radius.Mars && radius.Mars < radius.Jupiter);
  assert.ok(Math.abs(radius.Earth - 2.95) < 0.1, 'Earth just inside ring 3');
  assert.ok(radius.Pluto > 7 && radius.Pluto < 9, 'Pluto (35.6 AU) between Neptune and its mean orbit');
  assert.deepEqual(option.series.find((s) => s.name === 'Line of sight').data.map((v) => v[1]), [62.2, 135.8]);
  assert.equal(planets.find((p) => p.name === 'Jupiter').itemStyle.borderColor, '#fade2a');
  assert.equal(option.title.text, 'Mauritius - Reunion region');
  assert.match(option.title.subtext, /2026-11-24 11:06 UTC .* M 6\.4/);
  handlers.click({ data: { name: 'Saturn' } });
  assert.deepEqual(handlers.lastPartial, { 'var-body': 'Saturn' });
});

test('solar system code: Sun and Moon as $body, and a quake that is not recomputed yet', () => {
  const toSun = runSolarCode(ROWS, QUAKE, 'Sun').option.series.find((s) => s.name === 'Line of sight').data;
  assert.equal(toSun[0][1], 62.2, 'starts at the Earth');
  assert.deepEqual(toSun[1], [0, 0], 'ends at the Sun in the middle');
  assert.deepEqual(runSolarCode(ROWS, QUAKE, 'Moon').option.series.find((s) => s.name === 'Line of sight').data, []);
  const onlyEarth = runSolarCode([['Earth', 62.2, 0.987]], QUAKE, 'Mars').option;
  assert.match(onlyEarth.title.subtext, /still being computed/);
});
