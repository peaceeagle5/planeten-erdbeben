// Node-RED step, via the Node-RED admin HTTP API.
const { buildFlowTab, ownerFromInfo, BACKFILL_NODE_ID, DB_CONFIG_ID } = require('../../node-red/flow-builder');

const MYSQL_MODULE = 'node-red-node-mysql';

function baseUrl(url) {
  let u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u;
}

class NodeRed {
  constructor(cfg) {
    this.url = baseUrl(cfg.url);
    this.user = cfg.user;
    this.password = cfg.password;
    this.token = null;
  }

  async request(method, path, body, { timeoutMs = 15000, okStatuses = [200, 204] } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let res;
    try {
      res = await fetch(this.url + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const code = err.cause?.code || err.name;
      if (code === 'ECONNREFUSED') throw new Error(`Unter ${this.url} läuft kein Node-RED. Stimmen IP-Adresse und Port?`);
      if (code === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT') throw new Error(`${this.url} antwortet nicht. Stimmt die IP-Adresse?`);
      if (/bad port/i.test(err.cause?.message || '')) throw new Error(`Port in ${this.url} ist für Webanfragen gesperrt (z. B. 6000, 10080). Bitte einen anderen Port benutzen.`);
      throw new Error(`${this.url} nicht erreichbar (${err.cause?.code || err.cause?.message || err.message}).`);
    }
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* plain text */ }
    if (res.status === 401) throw new Error('Node-RED verlangt eine Anmeldung: Benutzername/Passwort für den Node-RED-Editor eintragen oder prüfen.');
    if (!okStatuses.includes(res.status)) {
      const msg = typeof data === 'object' && data ? data.message || data.error || JSON.stringify(data) : String(data).slice(0, 300);
      const err = new Error(`Node-RED ${method} ${path}: HTTP ${res.status} ${msg}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /** Logs in if the editor is protected (adminAuth); no-op otherwise. */
  async login() {
    if (this.token) return;
    const scheme = await this.request('GET', '/auth/login');
    if (!scheme || !scheme.type) return; // no login required
    if (scheme.type !== 'credentials') throw new Error(`Node-RED nutzt eine Anmeldung vom Typ "${scheme.type}", die das Setup nicht unterstützt.`);
    if (!this.user || !this.password) throw new Error('Node-RED verlangt eine Anmeldung: Benutzername und Passwort für den Node-RED-Editor eintragen.');
    const res = await fetch(`${this.url}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'node-red-admin', grant_type: 'password', scope: '*', username: this.user, password: this.password }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('Anmeldung bei Node-RED fehlgeschlagen: Benutzername oder Passwort falsch.');
    this.token = (await res.json()).access_token;
  }

  async info() {
    await this.login();
    const settings = await this.request('GET', '/settings');
    const nodes = await this.request('GET', '/nodes');
    const modules = new Set((Array.isArray(nodes) ? nodes : []).map((n) => n.module));
    // Node-RED assigns its own id to a tab created with POST /flow, but keeps our node ids,
    // so the tab is found via its backfill node.
    const flows = await this.request('GET', '/flows');
    const marker = (Array.isArray(flows) ? flows : []).find((n) => n.id === BACKFILL_NODE_ID);
    const tabId = marker ? marker.z : null;
    const tab = tabId ? flows.find((n) => n.id === tabId) : null;
    return {
      version: settings.version,
      functionExternalModules: settings.functionExternalModules !== false,
      paletteEditable: settings.editorTheme?.palette?.editable !== false,
      hasMysql: modules.has(MYSQL_MODULE),
      tabExists: Boolean(tabId),
      tabId,
      owner: tab ? ownerFromInfo(tab.info) : null,
      title: settings.editorTheme?.header?.title || null,
    };
  }

  async installMysqlNode(log) {
    log(`Installiere ${MYSQL_MODULE} in Node-RED (kann auf dem Raspberry Pi 1–2 Minuten dauern) ...`);
    await this.request('POST', '/nodes', { module: MYSQL_MODULE }, { timeoutMs: 5 * 60 * 1000 });
    log(`${MYSQL_MODULE} ist installiert.`);
  }

  /** Creates or replaces the "Planeten & Erdbeben" tab. Other tabs are not touched. */
  async deployTab(dbForNodeRed, existingTabId, owner) {
    const tab = buildFlowTab({
      dbHost: dbForNodeRed.host, dbPort: dbForNodeRed.port, dbName: dbForNodeRed.database, owner,
      tablePrefix: dbForNodeRed.tablePrefix,
    });
    const cfgNode = tab.configs.find((n) => n.id === DB_CONFIG_ID);
    cfgNode.credentials = { user: dbForNodeRed.user, password: dbForNodeRed.password };
    if (existingTabId) {
      tab.id = existingTabId;
      for (const n of [...tab.nodes, ...tab.configs]) n.z = existingTabId;
      await this.request('PUT', `/flow/${existingTabId}`, tab);
    } else {
      await this.request('POST', '/flow', tab);
    }
  }

  /** Clicks the backfill inject node with a custom year range. */
  async injectBackfill(year, minmag) {
    await this.login();
    const payload = JSON.stringify({ start: `${year}-01-01`, end: `${Number(year) + 1}-01-01`, minmag: Number(minmag) });
    await this.request('POST', `/inject/${BACKFILL_NODE_ID}`, {
      __user_inject_props__: [{ p: 'payload', v: payload, vt: 'json' }],
    });
  }
}

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** cfg.owner = name of the person running the wizard; cfg.allowOverwrite = confirmed overwrite. */
async function testNodeRed(cfg) {
  try {
    const nr = new NodeRed(cfg);
    const i = await nr.info();
    if (i.owner && cfg.owner && !sameName(i.owner, cfg.owner) && !cfg.allowOverwrite) {
      return {
        ok: false, ownerConflict: true, owner: i.owner,
        message: `Dieses Node-RED (${nr.url}) wurde von „${i.owner}“ eingerichtet. Ist das wirklich dein Port? ` +
          'Wenn ja, unten „Trotzdem überschreiben“ ankreuzen.',
      };
    }
    const notes = [];
    if (!i.functionExternalModules) {
      return { ok: false, message: `Node-RED ${i.version} erlaubt keine externen Module in Function-Nodes. In settings.js "functionExternalModules: true" setzen und Node-RED neu starten.` };
    }
    if (!i.hasMysql && !i.paletteEditable) {
      return { ok: false, message: `${MYSQL_MODULE} fehlt, und die Palette ist gesperrt. Bitte ${MYSQL_MODULE} auf dem Server installieren.` };
    }
    notes.push(i.hasMysql ? `${MYSQL_MODULE} ist vorhanden` : `${MYSQL_MODULE} wird installiert`);
    notes.push(i.tabExists ? `der Tab "Planeten & Erdbeben"${i.owner ? ` von ${i.owner}` : ''} wird aktualisiert` : 'der Tab "Planeten & Erdbeben" wird neu angelegt');
    const name = i.title && i.title !== 'Node-RED' ? ` („${i.title}“)` : '';
    return { ok: true, message: `Verbunden mit Node-RED ${i.version}${name}: ${notes.join(', ')}. Andere Flows bleiben unverändert.` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * Looks for Node-RED instances on host, ports from..to. For each one found:
 * {port, version, login (editor is password protected), owner (who ran this setup there), title}.
 */
async function scanNodeRed(host, from, to) {
  from = Number(from); to = Number(to);
  if (!host || !(from > 0) || !(to >= from) || to - from > 500) throw new Error('Bitte Adresse und einen Portbereich (höchstens 500 Ports) angeben.');
  const probe = async (port) => {
    const url = `http://${host}:${port}`;
    try {
      const res = await fetch(`${url}/auth/login`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return null;
      const scheme = await res.json(); // Node-RED answers {} or {type:"credentials", ...}
      if (typeof scheme !== 'object' || scheme === null || Array.isArray(scheme)) return null;
      if (scheme.type) {
        if (!Array.isArray(scheme.prompts)) return null;
        return { port, login: true };
      }
      const i = await new NodeRed({ url }).info();
      return { port, login: false, version: i.version, owner: i.owner, title: i.title };
    } catch {
      return null;
    }
  };
  const ports = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  const found = [];
  for (let k = 0; k < ports.length; k += 50) {
    found.push(...(await Promise.all(ports.slice(k, k + 50).map(probe))));
  }
  return found.filter(Boolean);
}

module.exports = { NodeRed, testNodeRed, scanNodeRed, baseUrl };
