// Switch between the Earth map and the solar system (dashboard variable $view), using Grafana's
// "dynamic dashboards" (dashboard schema v2, Grafana 12.4+/13 with dashboardNewLayouts).
//
// dashboard-builder.js builds a classic (v1) dashboard with the map and the solar system side by side.
// That works in every Grafana. If Grafana supports v2, the setup wizard lets Grafana translate the
// dashboard to v2 and passes it through toSwitchingLayout(): the panels are put into rows, and two rows
// get a show/hide rule:
//
//   row "Overview"      Pipeline, sky at the selected quake             always
//   row "Earth map"     map (full width) + quakes per plate              hidden when $view = solar
//   row "Solar system"  solar system (full width)                        shown only when $view = solar
//   row "Statistics"    bar charts, aspects                              always
//
// Show/hide rules only exist on rows, tabs and auto-grid items, not on freely placed panels; that is
// why the panels go into rows (whose headers are hidden, so the page looks the same).

const MAP_PANEL = 3;
const PLATES_PANEL = 8;
const SOLAR_PANEL = 9;
const OVERVIEW_PANELS = [1, 2];
const MOON_PHASE_PANEL = 4;
const ZODIAC_PANEL = 5;

const ref = (id) => `panel-${id}`;
const idOf = (item) => Number(String(item.spec.element.name).replace(/^panel-/, ''));

/** Show/hide rule: the row is visible only when $view has (or does not have) this value. */
function viewRule(visibility, value) {
  return {
    kind: 'ConditionalRenderingGroup',
    spec: {
      visibility, condition: 'and',
      items: [{ kind: 'ConditionalRenderingVariable', spec: { variable: 'view', operator: 'equals', value } }],
    },
  };
}

/** Grid items moved up so the first one starts at y = 0 (every row has its own grid). */
function grid(items) {
  const top = Math.min(...items.map((i) => i.spec.y));
  return { kind: 'GridLayout', spec: { items: items.map((i) => ({ ...i, spec: { ...i.spec, y: i.spec.y - top } })) } };
}

function row(title, items, conditionalRendering) {
  return {
    kind: 'RowsLayoutRow',
    spec: { title, collapse: false, hideHeader: true, fillScreen: false, layout: grid(items), ...(conditionalRendering ? { conditionalRendering } : {}) },
  };
}

const place = (item, x, y, width, height) => ({ ...item, spec: { ...item.spec, x, y, width, height } });

/**
 * @param {object} spec  v2 dashboard spec as Grafana returns it for our v1 dashboard (layout = GridLayout)
 * @returns {object}     the same spec with a RowsLayout and the $view variable visible
 */
function toSwitchingLayout(spec) {
  const items = spec.layout.spec.items;
  const byId = new Map(items.map((i) => [idOf(i), i]));
  for (const id of [...OVERVIEW_PANELS, MAP_PANEL, PLATES_PANEL, SOLAR_PANEL]) {
    if (!byId.has(id)) throw new Error(`Panel ${ref(id)} fehlt im Dashboard.`);
  }
  const special = new Set([...OVERVIEW_PANELS, MAP_PANEL, PLATES_PANEL, SOLAR_PANEL]);
  // the plates chart moved up into the map row: the two bar charts next to it share its width
  const rest = items.filter((i) => !special.has(idOf(i))).map((i) => {
    if (idOf(i) === MOON_PHASE_PANEL) return place(i, 0, i.spec.y, 12, i.spec.height);
    if (idOf(i) === ZODIAC_PANEL) return place(i, 12, i.spec.y, 12, i.spec.height);
    return i;
  });

  const rows = [
    row('Overview', OVERVIEW_PANELS.map((id) => byId.get(id))),
    row('Earth map', [place(byId.get(MAP_PANEL), 0, 0, 16, 15), place(byId.get(PLATES_PANEL), 16, 0, 8, 15)], viewRule('hide', 'solar')),
    row('Solar system', [place(byId.get(SOLAR_PANEL), 0, 0, 24, 17)], viewRule('show', 'solar')),
    row('Statistics', rest),
  ];

  const variables = spec.variables.map((v) => (v.spec && v.spec.name === 'view' ? { ...v, spec: { ...v.spec, hide: 'dontHide' } } : v));
  return { ...spec, variables, layout: { kind: 'RowsLayout', spec: { rows } } };
}

module.exports = { toSwitchingLayout, viewRule, MAP_PANEL, SOLAR_PANEL, PLATES_PANEL };
