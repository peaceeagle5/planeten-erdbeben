// The wizard switches to map/solar "View" only where Grafana supports it; a mock Grafana answers.
// node --test setup-wizard/lib/
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { enableViewSwitch } = require('./grafana');
const { buildDashboard } = require('../../grafana/dashboard-builder');

function v2Spec() {
  const v1 = buildDashboard({ uid: 'pe-anna' });
  return {
    title: v1.title, elements: {},
    variables: v1.templating.list.map((v) => ({ kind: 'CustomVariable', spec: { name: v.name, hide: 'hideVariable' } })),
    layout: { kind: 'GridLayout', spec: { items: v1.panels.map((p) => ({ kind: 'GridLayoutItem', spec: {
      x: p.gridPos.x, y: p.gridPos.y, width: p.gridPos.w, height: p.gridPos.h, element: { kind: 'ElementReference', name: `panel-${p.id}` } } })) } },
  };
}

/** Starts a fake Grafana. opts: newLayouts (feature flag), v2 (API exists), putStatus. */
async function fakeGrafana({ newLayouts = true, v2 = true, putStatus = 200 } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
      const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.url === '/api/frontend/settings') return json(200, { namespace: 'org-3', featureToggles: { dashboardNewLayouts: newLayouts } });
      if (req.url === '/apis/dashboard.grafana.app') return json(200, { versions: v2 ? [{ version: 'v2' }, { version: 'v1' }] : [{ version: 'v1' }] });
      if (req.url === '/apis/dashboard.grafana.app/v2/namespaces/org-3/dashboards/pe-anna') {
        if (req.method === 'GET') return json(200, { metadata: { name: 'pe-anna', resourceVersion: '42', labels: {}, annotations: { 'grafana.app/folder': 'abc' } }, spec: v2Spec() });
        return json(putStatus, putStatus === 200 ? {} : { message: 'forbidden' });
      }
      return json(404, { message: 'not found' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const cfg = { url: `http://127.0.0.1:${server.address().port}`, user: 'anna', password: 'x' };
  return { cfg, seen, close: () => new Promise((r) => server.close(r)) };
}

test('Grafana with dynamic dashboards: saved back as v2 with rows, folder and version kept', async () => {
  const g = await fakeGrafana();
  const logs = [];
  assert.equal(await enableViewSwitch(g.cfg, 'pe-anna', (m) => logs.push(m)), true);
  const put = g.seen.find((r) => r.method === 'PUT');
  assert.equal(put.url, '/apis/dashboard.grafana.app/v2/namespaces/org-3/dashboards/pe-anna');
  assert.equal(put.body.apiVersion, 'dashboard.grafana.app/v2');
  assert.equal(put.body.metadata.resourceVersion, '42');
  assert.equal(put.body.metadata.annotations['grafana.app/folder'], 'abc', 'stays in its folder');
  assert.equal(put.body.spec.layout.kind, 'RowsLayout');
  assert.match(logs.join('\n'), /„View“ umschalten/);
  await g.close();
});

test('older Grafana (no feature flag or no v2 API): nothing is changed, side by side', async () => {
  for (const opts of [{ newLayouts: false }, { v2: false }]) {
    const g = await fakeGrafana(opts);
    const logs = [];
    assert.equal(await enableViewSwitch(g.cfg, 'pe-anna', (m) => logs.push(m)), false);
    assert.ok(!g.seen.some((r) => r.method === 'PUT'));
    assert.match(logs.join('\n'), /nebeneinander/);
    await g.close();
  }
});

test('saving fails: no error for the setup, just side by side', async () => {
  const g = await fakeGrafana({ putStatus: 403 });
  const logs = [];
  assert.equal(await enableViewSwitch(g.cfg, 'pe-anna', (m) => logs.push(m)), false);
  assert.match(logs.join('\n'), /ging nicht \(forbidden\)/);
  await g.close();
});
