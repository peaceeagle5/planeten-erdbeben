// Grafana step: data source + dashboard, via the Grafana HTTP API.
// Works with personal accounts: every person gets their own dashboard. Admins can create a
// data source; Editors pick an existing one (e.g. created once by the teacher).
const { buildDashboard, uploadDashboard, grafanaAuthHeader, ECHARTS_PLUGIN } = require('../../grafana/dashboard-builder');
const { baseUrl } = require('./nodered');

// NFKD splits 'ü' into 'u' + combining diaeresis; the second replace drops the diaeresis
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 28).replace(/^-|-$/g, '') || 'user';

async function call(cfg, method, path, body) {
  const url = baseUrl(cfg.url);
  let res;
  try {
    res = await fetch(url + path, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: grafanaAuthHeader(cfg) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const code = err.cause?.code || err.name;
    if (code === 'ECONNREFUSED') throw new Error(`Unter ${url} läuft kein Grafana. Stimmen IP-Adresse und Port?`);
    if (/bad port/i.test(err.cause?.message || '')) throw new Error(`Port in ${url} ist für Webanfragen gesperrt (z. B. 6000, 10080). Bitte einen anderen Port benutzen.`);
    throw new Error(`${url} nicht erreichbar (${err.cause?.code || err.cause?.message || err.message}).`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Grafana: Benutzername oder Passwort falsch.');
  return { status: res.status, data };
}

/** MySQL data sources this user may query (works for Editors, unlike /api/datasources). */
async function mysqlDatasources(cfg) {
  const fe = await call(cfg, 'GET', '/api/frontend/settings');
  return Object.values(fe.data.datasources || {})
    .filter((d) => d.type === 'mysql')
    .map((d) => ({ uid: d.uid, name: d.name }));
}

async function whoAmI(cfg) {
  const health = await call(cfg, 'GET', '/api/health');
  if (health.status !== 200 || !health.data.version) {
    throw new Error(`Unter ${baseUrl(cfg.url)} läuft kein Grafana (HTTP ${health.status}). Stimmen IP-Adresse und Port?`);
  }
  const user = await call(cfg, 'GET', '/api/user');
  if (user.status !== 200) throw new Error(`Grafana-Anmeldung fehlgeschlagen (HTTP ${user.status}).`);
  const orgs = await call(cfg, 'GET', '/api/user/orgs');
  const role = ((orgs.data || []).find((o) => o.orgId === user.data.orgId) || {}).role || 'Viewer';
  return { version: health.data.version, login: user.data.login, role, isServerAdmin: Boolean(user.data.isGrafanaAdmin) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PLUGIN_HELP = `Auf dem Grafana-Server: "sudo grafana cli plugins install ${ECHARTS_PLUGIN}" und Grafana neu starten ` +
  '(oder in Grafana: Administration > Plugins > „Business Charts“ > Install).';

/** Panel plugins are listed in the frontend settings, which every user may read (also Editors). */
async function hasEchartsPlugin(cfg, pluginId = ECHARTS_PLUGIN) {
  const fe = await call(cfg, 'GET', '/api/frontend/settings');
  return Boolean(fe.data.panels && fe.data.panels[pluginId]);
}

/**
 * The solar system panel needs the Business Charts plugin. Installing plugins is only allowed for
 * Grafana server admins (not for organisation admins) and needs internet on the Grafana server.
 * Never fatal: without the plugin only that one panel stays empty.
 */
async function ensureEchartsPlugin(cfg, me, log, pluginId = ECHARTS_PLUGIN) {
  if (await hasEchartsPlugin(cfg, pluginId)) { log('Plugin „Business Charts“ (Sonnensystem-Panel) ist installiert.'); return true; }
  if (!me.isServerAdmin) {
    log(`Plugin „Business Charts“ fehlt in Grafana, das Sonnensystem-Panel bleibt leer. Installieren darf es nur ein Grafana-Server-Admin. ${PLUGIN_HELP}`);
    return false;
  }
  log('Installiere das Plugin „Business Charts“ (Sonnensystem-Panel) ...');
  const res = await call(cfg, 'POST', `/api/plugins/${pluginId}/install`, {});
  if (res.status !== 200) {
    log(`Plugin „Business Charts“ konnte nicht installiert werden (${res.data.message || `HTTP ${res.status}`}). Hat der Grafana-Server Internet? ${PLUGIN_HELP}`);
    return false;
  }
  for (let i = 0; i < 15; i++) {
    if (await hasEchartsPlugin(cfg, pluginId)) { log('Plugin „Business Charts“ ist installiert.'); return true; }
    await sleep(1000);
  }
  log('Plugin „Business Charts“ ist installiert. Falls das Sonnensystem-Panel noch fehlt: Grafana-Seite neu laden.');
  return true;
}

async function testGrafana(cfg) {
  try {
    const me = await whoAmI(cfg);
    if (me.role !== 'Admin' && me.role !== 'Editor') {
      return { ok: false, message: `Angemeldet als „${me.login}“, aber nur mit Leserechten (Viewer). Zum Anlegen eines Dashboards braucht das Konto mindestens die Rolle Editor.` };
    }
    const datasources = await mysqlDatasources(cfg);
    const isAdmin = me.role === 'Admin';
    const plugin = (await hasEchartsPlugin(cfg)) ? ' Plugin „Business Charts“ ist da.'
      : me.isServerAdmin ? ' Plugin „Business Charts“ fehlt noch und wird installiert.'
        : ' Plugin „Business Charts“ fehlt (das Sonnensystem-Panel bleibt leer, bis ein Grafana-Server-Admin es installiert).';
    if (!isAdmin && !datasources.length) {
      return { ok: false, message: `Angemeldet als „${me.login}“ (Rolle ${me.role}). Es gibt noch keine MySQL-Datenquelle, und nur ein Admin darf eine anlegen. ` +
        'Die Lehrkraft kann das Setup einmal mit einem Admin-Konto ausführen; danach hier die Datenquelle auswählen.' };
    }
    return {
      ok: true, login: me.login, role: me.role, canCreate: isAdmin, datasources,
      message: `Angemeldet bei Grafana ${me.version} als „${me.login}“ (Rolle ${me.role}). ` +
        (isAdmin ? 'Eine eigene Datenquelle wird angelegt.' : 'Bitte unten die Datenquelle auswählen.') + plugin,
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * cfg.datasourceUid: '' = create/update own data source (Admins only), otherwise use that one.
 * dbForGrafana: database address + login as seen from the Grafana server.
 */
async function setupGrafana(cfg, dbForGrafana, owner, log) {
  const me = await whoAmI(cfg);
  const who = owner || me.login;
  let dsUid = cfg.datasourceUid;
  let dsName;

  if (!dsUid) {
    if (me.role !== 'Admin') throw new Error('Nur ein Grafana-Admin darf eine Datenquelle anlegen. Bitte eine vorhandene Datenquelle auswählen.');
    dsUid = `pe-db-${slug(me.login)}`;
    dsName = `Planeten-Erdbeben ${dbForGrafana.database} (${me.login})`;
    const ds = {
      uid: dsUid, name: dsName, type: 'mysql', access: 'proxy',
      url: `${dbForGrafana.host}:${dbForGrafana.port}`, user: dbForGrafana.user, database: dbForGrafana.database,
      jsonData: { database: dbForGrafana.database, timezone: '+00:00', maxOpenConns: 10, maxIdleConns: 10, connMaxLifetime: 14400 },
      secureJsonData: { password: dbForGrafana.password },
    };
    const existing = await call(cfg, 'GET', `/api/datasources/uid/${dsUid}`);
    const saved = existing.status === 200
      ? await call(cfg, 'PUT', `/api/datasources/uid/${dsUid}`, { ...ds, id: existing.data.id })
      : await call(cfg, 'POST', '/api/datasources', ds);
    if (saved.status !== 200) throw new Error(`Grafana-Datenquelle konnte nicht gespeichert werden: ${saved.data.message || saved.status}`);
    log(`Datenquelle „${dsName}“ ist gespeichert.`);

    const health = await call(cfg, 'GET', `/api/datasources/uid/${dsUid}/health`);
    if (health.status !== 200 || health.data.status !== 'OK') {
      throw new Error(`Grafana erreicht die Datenbank unter ${ds.url} nicht: ${health.data.message || health.status}. ` +
        'Unter „Erweitert“ bei der Datenbank die Adresse aus Sicht des Grafana-Servers eintragen.');
    }
    log('Grafana erreicht die Datenbank.');
  } else {
    const chosen = (await mysqlDatasources(cfg)).find((d) => d.uid === dsUid);
    if (!chosen) throw new Error('Die ausgewählte Grafana-Datenquelle gibt es nicht (mehr).');
    dsName = chosen.name;
    log(`Verwende die Datenquelle „${dsName}“.`);
  }

  await ensureEchartsPlugin(cfg, me, log);
  const dashboard = buildDashboard({
    dsUid, dsName, uid: `pe-${slug(who)}`, title: `Planeten & Erdbeben (${who})`,
    tablePrefix: dbForGrafana.tablePrefix,
  });
  const url = await uploadDashboard(baseUrl(cfg.url), cfg, dashboard);
  log(`Dashboard „${dashboard.title}“ ist angelegt: ${url}`);
  return url;
}

module.exports = { testGrafana, setupGrafana, ensureEchartsPlugin, whoAmI };
