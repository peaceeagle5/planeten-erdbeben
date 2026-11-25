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
