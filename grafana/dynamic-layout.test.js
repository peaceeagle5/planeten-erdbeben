// Tests for the map / solar system switch (dashboard schema v2): node --test grafana/
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDashboard } = require('./dashboard-builder');
const { toSwitchingLayout } = require('./dynamic-layout');

/** What Grafana's v1 -> v2 conversion gives for our dashboard (only the parts the layout code uses). */
function asV2(v1) {
  return {
    title: v1.title,
    elements: Object.fromEntries(v1.panels.map((p) => [`panel-${p.id}`, { kind: 'Panel', spec: { id: p.id, title: p.title } }])),
    variables: v1.templating.list.map((v) => ({ kind: 'CustomVariable', spec: { name: v.name, hide: v.hide === 2 ? 'hideVariable' : 'dontHide' } })),
    layout: { kind: 'GridLayout', spec: { items: v1.panels.map((p) => ({
      kind: 'GridLayoutItem',
      spec: { x: p.gridPos.x, y: p.gridPos.y, width: p.gridPos.w, height: p.gridPos.h, element: { kind: 'ElementReference', name: `panel-${p.id}` } },
    })) } },
  };
}

const v1 = buildDashboard({ uid: 'pe-anna', tablePrefix: 'anna_' });
const spec = toSwitchingLayout(asV2(v1));
const rows = spec.layout.spec.rows;
const panelsOf = (row) => row.spec.layout.spec.items.map((i) => i.spec.element.name);
const rule = (row) => row.spec.conditionalRendering && row.spec.conditionalRendering.spec;

test('four rows without headers; every panel exactly once', () => {
  assert.equal(spec.layout.kind, 'RowsLayout');
  assert.deepEqual(rows.map((r) => r.spec.title), ['Overview', 'Earth map', 'Solar system', 'Statistics']);
  for (const r of rows) assert.equal(r.spec.hideHeader, true);
  const all = rows.flatMap(panelsOf).sort();
  assert.deepEqual(all, v1.panels.map((p) => `panel-${p.id}`).sort());
  assert.deepEqual(panelsOf(rows[0]), ['panel-1', 'panel-2']);
  assert.deepEqual(panelsOf(rows[1]), ['panel-3', 'panel-8']);
  assert.deepEqual(panelsOf(rows[2]), ['panel-9']);
});

test('map row hidden and solar row shown when $view = solar', () => {
  const variableRule = (r) => rule(r).items[0];
  assert.equal(rule(rows[0]), undefined);
  assert.equal(rule(rows[3]), undefined);
  assert.equal(rule(rows[1]).visibility, 'hide');
  assert.equal(rule(rows[2]).visibility, 'show');
  for (const r of [rows[1], rows[2]]) {
    assert.equal(rule(r).condition, 'and');
    assert.deepEqual(variableRule(r), { kind: 'ConditionalRenderingVariable', spec: { variable: 'view', operator: 'equals', value: 'solar' } });
  }
});

test('every row grid starts at the top, the solar system gets the full width, no gaps in the statistics', () => {
  for (const r of rows) assert.equal(Math.min(...r.spec.layout.spec.items.map((i) => i.spec.y)), 0, r.spec.title);
  assert.equal(rows[2].spec.layout.spec.items[0].spec.width, 24);
  const stats = rows[3].spec.layout.spec.items;
  for (const y of new Set(stats.map((i) => i.spec.y))) {
    const width = stats.filter((i) => i.spec.y === y).reduce((sum, i) => sum + i.spec.width, 0);
    assert.equal(width, 24, `statistics line at y=${y} fills the width`);
  }
});

test('the $view variable becomes visible, the others stay as they were', () => {
  const hide = Object.fromEntries(spec.variables.map((v) => [v.spec.name, v.spec.hide]));
  assert.equal(hide.view, 'dontHide');
  assert.equal(hide.event, 'hideVariable');
  assert.equal(hide.minmag, 'dontHide');
});

test('the map click switches to the solar system; "Latest quake" keeps the view', () => {
  const link = v1.panels.find((p) => p.type === 'geomap').fieldConfig.defaults.links[0].url;
  assert.match(link, /var-view=solar/);
  assert.match(v1.links[0].url, /\$\{view:queryparam\}/);
  const view = v1.templating.list.find((v) => v.name === 'view');
  assert.equal(view.hide, 2, 'hidden in the classic side-by-side dashboard');
  assert.equal(view.current.value, 'earth');
});

test('a dashboard without the expected panels is refused (then everything stays side by side)', () => {
  const broken = asV2({ ...v1, panels: v1.panels.filter((p) => p.id !== 9) });
  assert.throws(() => toSwitchingLayout(broken), /panel-9 fehlt/);
});
