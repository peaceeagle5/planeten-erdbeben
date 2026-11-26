// Builds the Grafana dashboard from the panel queries in grafana/queries.sql.
// Used by the setup wizard, and from the command line:
//
//   node grafana/dashboard-builder.js                     # only write dashboard.json
//   GRAFANA_URL=http://127.0.0.1:3000 GRAFANA_USER=admin GRAFANA_PASSWORD=... \
//     node grafana/dashboard-builder.js                   # write + upload
//   (or GRAFANA_TOKEN=<service account token> instead of user/password)
//   TABLE_PREFIX=anna_ node grafana/dashboard-builder.js  # queries read anna_events, ...
const { readAsset } = require('../shared/assets');
const { normalizePrefix, withPrefix } = require('../shared/tables');

// ---------------------------------------------------------------------------
// Parse queries.sql: blocks start with "-- ====", "-- N) Title", "-- ===="
// ---------------------------------------------------------------------------
function loadQueries() {
  const lines = readAsset('grafana/queries.sql').split('\n');
  const queries = {};
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/^-- (\d+)\) /);
    if (header && /^-- =+/.test(lines[i - 1] || '')) {
      current = Number(header[1]);
      queries[current] = [];
      while (i + 1 < lines.length && lines[i + 1].startsWith('--')) i++; // skip rest of header
      continue;
    }
    if (current && !lines[i].startsWith('--')) queries[current].push(lines[i]);
  }
  for (const k of Object.keys(queries)) queries[k] = queries[k].join('\n').trim().replace(/;$/, '');
  return queries;
}

const DS = { type: 'mysql', uid: '${ds}' };
/** Business Charts (Apache ECharts) panel plugin, for the solar system view. Must be installed in Grafana. */
const ECHARTS_PLUGIN = 'volkovlabs-echarts-panel';
const target = (sql) => ({ refId: 'A', datasource: DS, editorMode: 'code', rawQuery: true, format: 'table', rawSql: sql });

const QUAKE_COLOR = 'red';
const CONTROL_COLOR = 'text';
const PLATE_COLOR = '#5794f2';

// quakes_pct / control_pct get the same names and colors everywhere
const comparisonOverrides = [
  { matcher: { id: 'byName', options: 'quakes_pct' }, properties: [
    { id: 'displayName', value: 'Earthquakes' },
    { id: 'color', value: { mode: 'fixed', fixedColor: QUAKE_COLOR } }] },
  { matcher: { id: 'byName', options: 'control_pct' }, properties: [
    { id: 'displayName', value: 'Control (same place, random time)' },
    { id: 'color', value: { mode: 'fixed', fixedColor: CONTROL_COLOR } }] },
];

function barChart(id, title, description, sql, xField, gridPos) {
  return {
    id, type: 'barchart', title, description, gridPos, datasource: DS, targets: [target(sql)],
    fieldConfig: { defaults: { unit: 'percent', decimals: 1, min: 0, custom: { fillOpacity: 80, lineWidth: 0 } }, overrides: comparisonOverrides },
    options: {
      xField, orientation: 'auto', groupWidth: 0.75, barWidth: 0.9, showValue: 'never', stacking: 'none',
      xTickLabelRotation: 0, legend: { showLegend: true, displayMode: 'list', placement: 'bottom' },
      tooltip: { mode: 'multi', sort: 'none' },
    },
  };
}

// ---------------------------------------------------------------------------
// Canvas: latest quake + where every body stood (zodiac sign, R = retrograde)
// ---------------------------------------------------------------------------
function canvasElements() {
  const els = [];
  const scale = { horizontal: 'scale', vertical: 'scale' };
  const box = (left, top, width, height) => ({ left, top, right: 100 - left - width, bottom: 100 - top - height });
  const rect = (name, text, place, opts = {}) => els.push({
    type: 'rectangle', name,
    config: { text, color: { fixed: opts.color || '#e6e6e6' }, size: opts.size || 16, align: 'center', valign: 'middle' },
    background: { color: { fixed: opts.bg || 'transparent' } },
    border: { color: { fixed: opts.border || 'transparent' }, width: opts.border ? 1 : 0, radius: 6 },
    constraint: scale, placement: place,
  });
  const field = (f) => ({ mode: 'field', field: f, fixed: '' });
  const fixed = (t) => ({ mode: 'fixed', fixed: t });

  // header row
  rect('Title', field('selection'), box(1, 2, 20, 20), { size: 14, color: '#9fa7b3' });
  rect('Place', field('place'), box(1, 14, 40, 18), { size: 20 });
  rect('Magnitude label', fixed('Magnitude'), box(43, 2, 12, 12), { size: 12, color: '#9fa7b3' });
  rect('Magnitude', field('magnitude'), box(43, 12, 12, 20), { size: 26, color: '#ff7383' });
  rect('Depth label', fixed('Depth km'), box(56, 2, 12, 12), { size: 12, color: '#9fa7b3' });
  rect('Depth', field('depth_km'), box(56, 12, 12, 20), { size: 22 });
  rect('Moon phase label', fixed('Moon phase °'), box(69, 2, 12, 12), { size: 12, color: '#9fa7b3' });
  rect('Moon phase', field('moon_phase_deg'), box(69, 12, 12, 20), { size: 22 });
  rect('Time label', fixed('Time (UTC)'), box(82, 2, 17, 12), { size: 12, color: '#9fa7b3' });
  rect('Time', field('time_utc'), box(82, 12, 17, 20), { size: 14 });

  // body cards: 2 rows x 5
  const bodies = [
    ['Sun', '☉'], ['Moon', '☽'], ['Mercury', '☿'], ['Venus', '♀'], ['Mars', '♂'],
    ['Jupiter', '♃'], ['Saturn', '♄'], ['Uranus', '♅'], ['Neptune', '♆'], ['Pluto', '♇'],
  ];
  bodies.forEach(([name, symbol], i) => {
    const left = 1 + (i % 5) * 19.8;
    const top = i < 5 ? 38 : 69;
    rect(`${name} card`, fixed(''), box(left, top, 18.6, 28), { bg: 'rgba(128,128,128,0.08)', border: 'rgba(128,128,128,0.35)' });
    rect(`${name} label`, fixed(`${symbol} ${name}`), box(left, top + 2, 18.6, 11), { size: 14, color: '#9fa7b3' });
    rect(`${name} value`, field(name), box(left, top + 12, 18.6, 14), { size: 18 });
  });
  return els;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const custom = (name, label, values, current, description) => ({
  type: 'custom', name, label, description, query: values.join(','), multi: false, includeAll: false,
  current: { text: current, value: current },
  options: values.map((v) => ({ text: v, value: v, selected: v === current })),
});

// Clicking a quake on the map reopens this dashboard with var-event=<id>, switches $view to the solar
// system (only has an effect in the v2 layout, see dynamic-layout.js) and keeps the other choices.
const QUAKE_LINK = '/d/${__dashboard.uid}?var-event=${__data.fields.event_id}&var-view=solar' +
  '&${ds:queryparam}&${minmag:queryparam}&${body:queryparam}&${orb:queryparam}&${__url_time_range}';

// Correlation finder (query 13): Moon only, see the query's comment and tools/korrelation.js
const CORRELATION_NOTE = 'Is a Moon position more common at earthquakes than at control events (same place, random time)? ' +
  '"Difference" = how many % more or fewer quakes than chance. z = distance from chance: |z| ≥ 2 happens by chance in 1 of 20 bins, ' +
  '|z| ≥ 3 in 1 of 370, so with many bins a single |z| of 2 means little. Choose a time range to find an effect, then check it in another. ' +
  'Aftershocks: "Main shocks only" drops a quake if a stronger one was within 3 days and 300 km. ' +
  'Only the Moon: the controls lie in the 2 years before each quake, a fair baseline only for things that repeat often in that time. ' +
  'Full analysis with p-values and a search over everything: npm run korrelation.';
const Z_COLORS = [
  { type: 'range', options: { from: 3, to: null, result: { color: 'red', index: 0 } } },
  { type: 'range', options: { from: null, to: -3, result: { color: 'red', index: 1 } } },
  { type: 'range', options: { from: 2, to: 3, result: { color: 'orange', index: 2 } } },
  { type: 'range', options: { from: -3, to: -2, result: { color: 'orange', index: 3 } } },
];
const hidden = (name) => ({ matcher: { id: 'byName', options: name }, properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: true, tooltip: false } }] });

const COMPARE_NOTE = 'Red = earthquakes, grey = control events (same places, random times). Only the difference between them matters.';

/**
 * @param {{dsUid?:string, dsName?:string, uid?:string, title?:string, tablePrefix?:string}} [opts]
 *   dsUid/dsName: data source preselected in the $ds variable;
 *   uid/title: one dashboard per person when several people share a Grafana;
 *   tablePrefix: this person's tables, e.g. "anna_" -> anna_events (see shared/tables.js).
 */
function buildDashboard({ dsUid, dsName, uid = 'planeten-erdbeben', title = 'Planeten & Erdbeben', tablePrefix } = {}) {
const prefix = normalizePrefix(tablePrefix);
const Q = Object.fromEntries(Object.entries(loadQueries()).map(([k, sql]) => [k, withPrefix(sql, prefix)]));
const dashboard = {
  uid,
  title,
  tags: ['earthquakes', 'planets'],
  timezone: 'utc',
  editable: true,
  refresh: '5m',
  time: { from: 'now-2y', to: 'now' },
  schemaVersion: 39,
  templating: { list: [
    { type: 'datasource', name: 'ds', label: 'Data source', query: 'mysql', hide: 0,
      ...(dsUid ? { current: { text: dsName || dsUid, value: dsUid } } : {}) },
    custom('minmag', 'Min. magnitude', ['4.5', '5', '6', '7'], '4.5'),
    custom('body', 'Body', ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'], 'Moon'),
    custom('orb', 'Aspect orb °', ['1', '2', '4', '8'], '8'),
    { type: 'custom', name: 'metric', label: 'Correlation', multi: false, includeAll: false, hide: 0,
      query: 'Moon phase : moon-phase,Moon height above the quake region : moon-altitude,Moon distance : moon-distance',
      current: { text: 'Moon phase', value: 'moon-phase' },
      options: [['Moon phase', 'moon-phase'], ['Moon height above the quake region', 'moon-altitude'], ['Moon distance', 'moon-distance']]
        .map(([text, value]) => ({ text, value, selected: value === 'moon-phase' })) },
    custom('step', 'Step °', ['15', '30', '45', '60'], '30'),
    { type: 'custom', name: 'aftershocks', label: 'Aftershocks', multi: false, includeAll: false, hide: 0,
      query: 'Main shocks only : main,All quakes : keep', current: { text: 'Main shocks only', value: 'main' },
      options: [{ text: 'Main shocks only', value: 'main', selected: true }, { text: 'All quakes', value: 'keep', selected: false }] },
    // hidden; set by the map's data link. Empty = latest quake (queries 6 and 10)
    { type: 'textbox', name: 'event', label: 'Selected quake', query: '', current: { text: '', value: '' }, hide: 2 },
    // Earth map or solar system. Hidden here (side by side); grafana/dynamic-layout.js shows it and
    // hides one of the two rows, where Grafana supports dynamic dashboards.
    { type: 'custom', name: 'view', label: 'View', query: 'Earth map : earth,Solar system : solar', multi: false, includeAll: false, hide: 2,
      current: { text: 'Earth map', value: 'earth' },
      options: [{ text: 'Earth map', value: 'earth', selected: true }, { text: 'Solar system', value: 'solar', selected: false }] },
  ] },
  links: [{
    type: 'link', title: 'Latest quake', icon: 'sync', tooltip: 'Show the sky at the latest earthquake again',
    url: `/d/${uid}?var-event=&\${ds:queryparam}&\${minmag:queryparam}&\${body:queryparam}&\${orb:queryparam}&\${view:queryparam}`,
    keepTime: true, includeVars: false, targetBlank: false, asDropdown: false, tags: [],
  }],
  panels: [
    {
      id: 1, type: 'stat', title: 'Pipeline', gridPos: { x: 0, y: 0, w: 24, h: 4 }, datasource: DS, targets: [target(Q[7])],
      description: 'Events stored in the database. "pending" = waiting for planetary positions from the API.',
      fieldConfig: { defaults: { color: { mode: 'fixed', fixedColor: 'text' } }, overrides: [
        { matcher: { id: 'byName', options: 'pending' }, properties: [{ id: 'thresholds', value: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'orange', value: 1 }] } }, { id: 'color', value: { mode: 'thresholds' } }] }] },
      options: { reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false }, colorMode: 'value', graphMode: 'none', textMode: 'value_and_name', justifyMode: 'center', orientation: 'vertical' },
    },
    {
      id: 2, type: 'canvas', title: 'Sky at the selected earthquake (latest if none)', gridPos: { x: 0, y: 4, w: 24, h: 10 }, datasource: DS, targets: [target(Q[6])],
      description: 'Zodiac position of every body when the selected quake happened. Click a quake on the map to select it; ' +
        '"Latest quake" (top right) goes back to the most recent one. R = retrograde.',
      fieldConfig: { defaults: {}, overrides: [] },
      options: { inlineEditing: true, showAdvancedTypes: true, panZoom: false, infinitePan: false, root: {
        type: 'frame', name: 'Element root', elements: canvasElements(),
        background: { color: { fixed: 'transparent' } }, border: { color: { fixed: 'dark-green' } },
        constraint: { horizontal: 'left', vertical: 'top' }, placement: {},
      } },
    },
    {
      id: 3, type: 'geomap', title: 'Earthquakes (time range, M ≥ $minmag): click a quake to see its sky', gridPos: { x: 0, y: 14, w: 14, h: 14 }, datasource: DS,
      targets: [target(Q[1]), { ...target(Q[8]), refId: 'B' }, { ...target(Q[10]), refId: 'C' }],
      description: 'Red dots: earthquakes. Blue lines: boundaries of the tectonic plates (PB2002, loaded by Node-RED). ' +
        'White ring: the quake shown in the sky panel above. Click a quake, then "Show the sky at this quake".',
      fieldConfig: { defaults: { color: { mode: 'continuous-YlRd' }, decimals: 1,
        links: [{ title: 'Show the sky at this quake', url: QUAKE_LINK, oneClick: true }] }, overrides: [
        { matcher: { id: 'byName', options: 'event_id' }, properties: [{ id: 'displayName', value: 'Event ID' }, { id: 'decimals', value: 0 }] },
      ] },
      options: {
        view: { id: 'zero', lat: 0, lon: 0, zoom: 1, allLayers: true },
        controls: { showZoom: true, mouseWheelZoom: true, showAttribution: true },
        tooltip: { mode: 'details' },
        // not 'default': that loads CARTO tiles, which show "API key required" without a key
        basemap: { type: 'osm-standard', name: 'Basemap', config: {} },
        layers: [{
          type: 'markers', name: 'Plate boundaries', tooltip: false,
          filterData: { id: 'byRefId', options: 'B' },
          location: { mode: 'coords', latitude: 'latitude', longitude: 'longitude' },
          config: { showLegend: false, style: {
            size: { fixed: 1, min: 1, max: 1 },
            color: { fixed: PLATE_COLOR },
            opacity: 0.8, symbol: { mode: 'fixed', fixed: 'img/icons/marker/circle.svg' },
          } },
        }, {
          type: 'markers', name: 'Earthquakes', tooltip: true,
          filterData: { id: 'byRefId', options: 'A' },
          location: { mode: 'coords', latitude: 'latitude', longitude: 'longitude' },
          config: { showLegend: true, style: {
            size: { field: 'magnitude', fixed: 5, min: 3, max: 18 },
            color: { field: 'magnitude', fixed: 'dark-red' },
            opacity: 0.6, symbol: { mode: 'fixed', fixed: 'img/icons/marker/circle.svg' },
          } },
        }, {
          type: 'markers', name: 'Selected quake', tooltip: false,
          filterData: { id: 'byRefId', options: 'C' },
          location: { mode: 'coords', latitude: 'latitude', longitude: 'longitude' },
          config: { showLegend: false, style: {
            size: { fixed: 24 }, color: { fixed: 'white' }, opacity: 0.45, lineWidth: 3,
            symbol: { mode: 'fixed', fixed: 'img/icons/marker/circle.svg' },
          } },
        }],
      },
    },
    {
      id: 9, type: ECHARTS_PLUGIN, title: 'Solar system at the selected earthquake (click a planet)', gridPos: { x: 14, y: 14, w: 10, h: 14 },
      datasource: DS, targets: [target(Q[11]), { ...target(Q[12]), refId: 'B' }],
      description: 'The planets around the Sun when the selected quake happened, seen from above (north up). ' +
        'Angle = longitude seen from the Sun. Not to scale: every orbit has its own ring; real distances in the tooltip. ' +
        'Dashed line: from the Earth to the selected body ($body), the direction we see it in. Click a planet to select it. ' +
        'Needs the Business Charts plugin; code in grafana/solar-system.echarts.js.',
      options: { editorMode: 'code', getOption: readAsset('grafana/solar-system.echarts.js'), renderer: 'canvas', map: 'none' },
    },
    {
      id: 8, type: 'barchart', title: 'Earthquakes per tectonic plate (M ≥ $minmag)', gridPos: { x: 16, y: 28, w: 8, h: 10 },
      datasource: DS, targets: [target(Q[9])],
      description: 'Number of quakes in the time range on each plate (the 15 plates with the most). ' +
        'Most quakes happen where plates meet, so plates with long, active boundaries lead.',
      fieldConfig: { defaults: { decimals: 0, min: 0, color: { mode: 'fixed', fixedColor: QUAKE_COLOR }, custom: { fillOpacity: 80, lineWidth: 0 } },
        overrides: [{ matcher: { id: 'byName', options: 'quakes' }, properties: [{ id: 'displayName', value: 'Earthquakes' }] }] },
      options: {
        xField: 'plate', orientation: 'horizontal', groupWidth: 0.75, barWidth: 0.8, showValue: 'auto', stacking: 'none',
        xTickLabelRotation: 0, legend: { showLegend: false, displayMode: 'list', placement: 'bottom' },
        tooltip: { mode: 'single', sort: 'none' },
      },
    },
    barChart(4, 'Moon phase: earthquakes vs. control', COMPARE_NOTE, Q[2], 'phase', { x: 0, y: 28, w: 8, h: 10 }),
    barChart(5, 'Zodiac sign of $body: earthquakes vs. control', COMPARE_NOTE, Q[3], 'sign', { x: 8, y: 28, w: 8, h: 10 }),
    barChart(6, 'Moon above / below the horizon at the quake location', COMPARE_NOTE, Q[5], 'moon', { x: 0, y: 38, w: 8, h: 10 }),
    {
      id: 7, type: 'table', title: 'Aspects that differ most (orb ≤ $orb°)', gridPos: { x: 8, y: 38, w: 16, h: 10 }, datasource: DS, targets: [target(Q[4])],
      description: 'Share of events that had each aspect. Only aspects seen at least 30 times are listed. With many aspects, some differences are expected by chance.',
      fieldConfig: { defaults: { decimals: 1 }, overrides: [
        ...comparisonOverrides,
        { matcher: { id: 'byRegexp', options: '.*_pct' }, properties: [{ id: 'unit', value: 'percent' }] },
        { matcher: { id: 'byName', options: 'diff_pct' }, properties: [
          { id: 'displayName', value: 'Difference' },
          { id: 'custom.cellOptions', value: { type: 'color-text' } },
          { id: 'color', value: { mode: 'continuous-RdYlGr' } }] },
        { matcher: { id: 'byName', options: 'n' }, properties: [{ id: 'displayName', value: 'Count' }, { id: 'decimals', value: 0 }] },
      ] },
      options: { showHeader: true, cellHeight: 'sm' },
    },
    {
      ...barChart(10, 'Correlation finder: ${metric:text} (M ≥ $minmag, ${aftershocks:text})', CORRELATION_NOTE, Q[13], 'bin', { x: 0, y: 48, w: 12, h: 11 }),
      fieldConfig: { defaults: { unit: 'percent', decimals: 1, min: 0, custom: { fillOpacity: 80, lineWidth: 0 } },
        overrides: [...comparisonOverrides, hidden('diff_pct'), hidden('quakes'), hidden('z')] },
    },
    {
      id: 11, type: 'table', title: 'Correlation finder: numbers (${metric:text}, ${step}° steps)', gridPos: { x: 12, y: 48, w: 12, h: 11 },
      datasource: DS, targets: [target(Q[13])], description: CORRELATION_NOTE,
      fieldConfig: { defaults: { decimals: 1 }, overrides: [
        ...comparisonOverrides,
        { matcher: { id: 'byName', options: 'bin' }, properties: [{ id: 'displayName', value: 'Range' }] },
        { matcher: { id: 'byName', options: 'quakes_pct' }, properties: [{ id: 'unit', value: 'percent' }] },
        { matcher: { id: 'byName', options: 'control_pct' }, properties: [{ id: 'unit', value: 'percent' }, { id: 'displayName', value: 'Control' }] },
        { matcher: { id: 'byName', options: 'diff_pct' }, properties: [{ id: 'displayName', value: 'Difference' }, { id: 'unit', value: 'percent' }, { id: 'decimals', value: 0 }] },
        { matcher: { id: 'byName', options: 'quakes' }, properties: [{ id: 'displayName', value: 'Quakes' }, { id: 'decimals', value: 0 }] },
        // |z| < 2 stays neutral (no colour), 2..3 orange, >= 3 red
        { matcher: { id: 'byName', options: 'z' }, properties: [
          { id: 'mappings', value: Z_COLORS },
          { id: 'thresholds', value: { mode: 'absolute', steps: [{ color: 'transparent', value: null }] } },
          { id: 'custom.cellOptions', value: { type: 'color-background' } }] },
      ] },
      options: { showHeader: true, cellHeight: 'sm' },
    },
  ],
};

return dashboard;
}

/** Upload (create or overwrite) the dashboard. auth = {token} or {user, password}. */
async function uploadDashboard(grafanaUrl, auth, dashboard) {
  const base = grafanaUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/dashboards/db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: grafanaAuthHeader(auth) },
    body: JSON.stringify({ dashboard, overwrite: true, message: 'Planeten-Erdbeben setup' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Dashboard upload failed: HTTP ${res.status} ${body.message || JSON.stringify(body)}`);
  return `${base}${body.url}`;
}

function grafanaAuthHeader({ token, user, password }) {
  return token ? `Bearer ${token}` : 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
}

module.exports = { buildDashboard, uploadDashboard, grafanaAuthHeader, DASHBOARD_UID: 'planeten-erdbeben', ECHARTS_PLUGIN };

if (require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const dashboard = buildDashboard({ dsUid: process.env.GRAFANA_DS_UID, tablePrefix: process.env.TABLE_PREFIX });
  const outFile = path.join(__dirname, 'dashboard.json');
  fs.writeFileSync(outFile, JSON.stringify(dashboard, null, 2) + '\n');
  console.log(`Wrote ${outFile} (${dashboard.panels.length} panels)`);
  if (process.env.GRAFANA_URL) {
    const auth = { token: process.env.GRAFANA_TOKEN, user: process.env.GRAFANA_USER, password: process.env.GRAFANA_PASSWORD };
    uploadDashboard(process.env.GRAFANA_URL, auth, dashboard)
      .then((url) => console.log(`Uploaded: ${url}`))
      .catch((e) => { console.error(e.message); process.exit(1); });
  }
}
