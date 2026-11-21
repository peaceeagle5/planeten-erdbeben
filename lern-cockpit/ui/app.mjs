// Lern-Cockpit page: unit list, explanations, editor, results, solutions and the terminal.
import { esc, md } from './markdown.mjs';
import { highlight, langForFile } from './highlight.mjs';
import { createTerminal } from './terminal.mjs';

const TOKEN = new URLSearchParams(location.search).get('t') || '';
const $ = (id) => document.getElementById(id);

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(`lc.${key}`);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`lc.${key}`, JSON.stringify(value));
    } catch { /* private mode: nothing is remembered */ }
  },
};

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Token': TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Fehler ${response.status}`);
  return json;
}

const fileUrl = (path) => `/api/file?path=${encodeURIComponent(path)}`;
const readFile = async (path) => (await api(fileUrl(path))).content;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const S = {
  units: [],
  workDir: '',
  filter: store.get('filter', 'alle'),
  view: store.get('view', { unit: null, tab: 'readme' }),
  editor: null, // { path, saved, text, dirty }
};

const unitByDir = (dir) => S.units.find((u) => u.dir === dir);
const isDirty = () => Boolean(S.editor?.dirty);

/** Skipped tests (answer still empty, database not reachable …) count as open. */
function progressText(p) {
  if (!p.total) return 'noch nicht geprüft';
  const open = p.total - p.pass;
  const openText = open ? `, ${open} offen` : '';
  return `${p.pass} von ${p.total} Tests bestanden${openText}`;
}

function badge(p) {
  if (!p?.total) return '<span class="badge" title="Noch nicht geprüft">–</span>';
  let cls = '';
  if (p.pass === p.total) cls = 'ok';
  else if (p.pass > 0) cls = 'part';
  return `<span class="badge ${cls}" title="${progressText(p)}">${p.pass}/${p.total}</span>`;
}

function inFilter(u) {
  if (S.filter === 'fiae') return u.fiae === '●';
  if (S.filter === 'fisi') return u.fisi === '●' || u.fisi === '○';
  return true;
}

// ---------------------------------------------------------------------------
// Sidebar, unit head, tabs
// ---------------------------------------------------------------------------
function navItem(unit, num, title, extra = {}) {
  const cls = ['item'];
  if (S.view.unit === unit) cls.push('on');
  if (extra.dim) cls.push('dim');
  const tip = extra.title ? ` title="${esc(extra.title)}"` : '';
  return `<button class="${cls.join(' ')}" data-unit="${unit ?? ''}"${tip}>`
    + `<span class="num">${num}</span><span class="t">${esc(title)}</span>${extra.badge ?? ''}</button>`;
}

function renderNav() {
  for (const b of $('filter').children) b.classList.toggle('on', b.dataset.f === S.filter);
  let html = navItem(null, '≡', 'Übersicht') + navItem('@spick', '✎', 'Spickzettel') + '<div class="sep"></div>';
  for (const u of S.units.filter(inFilter)) {
    const reading = S.filter === 'fisi' && u.fisi === '○';
    const title = reading ? `${u.topic} (zum Lesen)` : u.topic;
    html += navItem(u.dir, u.num, u.title, { dim: reading, title, badge: badge(u.progress) });
  }
  $('nav').innerHTML = html;
}

function tabsFor(u) {
  const tabs = [['readme', 'Erklärung']];
  for (const f of u.files.filter((x) => x.kind === 'edit')) tabs.push([`file:${f.name}`, f.name]);
  tabs.push(['results', 'Ergebnis']);
  if (u.files.some((f) => f.kind === 'solution')) tabs.push(['solution', 'Lösung']);
  return tabs;
}

function tabButton([id, label]) {
  const dirtyFile = isDirty() ? `file:${S.editor.path.split('/')[1]}` : null;
  const dot = id === dirtyFile ? ' <span class="dot">●</span>' : '';
  const on = S.view.tab === id ? 'on' : '';
  return `<button class="${on}" data-tab="${esc(id)}">${esc(label)}${dot}</button>`;
}

function renderHead() {
  const u = unitByDir(S.view.unit);
  if (!u) {
    $('unitHead').innerHTML = '';
    $('tabs').innerHTML = '';
    $('tabs').style.display = 'none';
    return;
  }
  $('tabs').style.display = '';
  const meta = [u.exercises, u.time, progressText(u.progress)].filter(Boolean).map(esc).join(' · ');
  $('unitHead').innerHTML = `<div class="unit-head"><h2>${u.num} · ${esc(u.title)}</h2>`
    + `<span class="meta">${meta}</span><span class="spacer"></span>`
    + '<button class="primary" id="checkBtn" title="Speichert und führt die Tests dieser Einheit im Terminal aus (Strg+Enter)">Prüfen ▶</button></div>';
  $('checkBtn').onclick = () => checkUnit(u.dir);
  $('tabs').innerHTML = tabsFor(u).map(tabButton).join('');
}

// ---------------------------------------------------------------------------
// Content views
// ---------------------------------------------------------------------------
async function renderOverview(c) {
  const content = await readFile('README.md');
  c.innerHTML = `<div class="doc"><div class="note">
    <p><strong>So arbeitest du hier:</strong> Links eine Einheit wählen, die <em>Erklärung</em> lesen, dann die Übungsdatei
    (z. B. <code>uebung.js</code>) bearbeiten und auf <strong>Prüfen ▶</strong> klicken.</p>
    <p>Unten ist ein echtes Terminal. <strong>Prüfen</strong> tippt dort z. B. <code>node --test "01-js-werkzeuge/*.test.js"</code> für dich –
    du kannst die Befehle auch selbst eingeben. <code>hilfe</code> zeigt alle Befehle.</p>
    <p>Deine Lösungen liegen im Ordner <code>${esc(S.workDir)}</code>. Der Ordner gehört dir: <code>git pull</code> überschreibt
    ihn nicht, und er kommt nicht ins Git-Repository.</p></div>${md(content, 'lernen')}</div>`;
}

async function renderReadme(c, u) {
  const content = await readFile(`${u.dir}/README.md`);
  const base = 'lernen/' + u.dir;
  c.innerHTML = `<div class="doc">${md(content, base)}</div>`;
}

function updateEditorState() {
  const el = $('edState');
  if (!el || !S.editor) return;
  el.textContent = S.editor.dirty ? '● nicht gespeichert' : 'gespeichert';
  el.className = S.editor.dirty ? 'state dirty' : 'state';
}

function setDirty(dirty) {
  if (!S.editor || S.editor.dirty === dirty) return;
  S.editor.dirty = dirty;
  updateEditorState();
  renderHead();
}

async function save() {
  if (!isDirty()) return true;
  try {
    await api('/api/file', { path: S.editor.path, content: S.editor.text });
    S.editor.saved = S.editor.text;
    setDirty(false);
    return true;
  } catch (err) {
    alert(`Speichern fehlgeschlagen: ${err.message}`);
    return false;
  }
}

async function resetToTemplate(path) {
  const name = path.split('/')[1];
  const question = `Deine Version von ${name} wird durch die leere Vorlage ersetzt.\n`
    + 'Sie wird vorher in meine-uebungen/.cockpit/sicherungen gesichert.\n\nWirklich?';
  if (!confirm(question)) return;
  try {
    const result = await api('/api/reset', { path });
    S.editor = null;
    await render();
    term.info(`Vorlage wiederhergestellt. Deine alte Version: meine-uebungen/${result.backup}`);
  } catch (err) {
    alert(err.message);
  }
}

async function renderEditor(c, u, name) {
  const path = `${u.dir}/${name}`;
  const content = await readFile(path);
  const keep = S.editor?.path === path && S.editor.dirty ? S.editor.text : null;
  S.editor = { path, saved: content, text: keep ?? content, dirty: keep !== null };
  c.innerHTML = `<div class="editor-bar"><span class="name">meine-uebungen/${esc(path)}</span><span class="state" id="edState"></span>
    <span class="spacer"></span>
    <button id="edReset" title="Ersetzt die Datei durch die leere Vorlage. Deine Version wird vorher gesichert.">Vorlage wiederherstellen</button>
    <button id="edSave">Speichern (Strg+S)</button></div>
    <div class="editor"><div class="gutter" id="gutter"></div><div class="code-wrap">
    <pre class="code hl" id="hl" aria-hidden="true"></pre>
    <textarea class="code" id="ed" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div></div>`;
  const ed = $('ed');
  const gutter = $('gutter');
  const hl = $('hl');
  const lang = langForFile(name);
  // The textarea is transparent; the coloured copy below it shows the text.
  const paint = () => {
    gutter.textContent = Array.from({ length: ed.value.split('\n').length }, (_, k) => k + 1).join('\n');
    hl.innerHTML = `${highlight(ed.value, lang)}\n`;
  };
  ed.value = S.editor.text;
  paint();
  updateEditorState();
  ed.addEventListener('input', () => {
    S.editor.text = ed.value;
    setDirty(ed.value !== S.editor.saved);
    paint();
  });
  ed.addEventListener('scroll', () => {
    gutter.scrollTop = ed.scrollTop;
    hl.scrollTop = ed.scrollTop;
    hl.scrollLeft = ed.scrollLeft;
  });
  ed.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    ed.setRangeText('  ', ed.selectionStart, ed.selectionEnd, 'end');
    ed.dispatchEvent(new Event('input'));
  });
  $('edSave').onclick = () => save();
  $('edReset').onclick = () => resetToTemplate(path);
}

/** "+ actual" lines red, "- expected" lines green. */
function diffLine(text) {
  if (/^\s*\+ /.test(text)) return `<span class="add">${text}</span>`;
  if (/^\s*- /.test(text)) return `<span class="del">${text}</span>`;
  return text;
}

const STATUS_ICON = { pass: '✔', fail: '✖', skip: '–' };

function testRow(t) {
  let extra = '';
  if (t.status === 'fail' && t.message && t.leaf) extra = `<pre>${esc(t.message).split('\n').map(diffLine).join('\n')}</pre>`;
  if (t.status === 'skip' && t.message) extra = `<div class="skipmsg">übersprungen: ${esc(t.message)}</div>`;
  const cls = ['test', t.status, t.leaf ? '' : 'parent'].join(' ');
  const pad = t.nesting * 22;
  return `<div class="${cls}" style="padding-left:${pad}px"><span class="ic">${STATUS_ICON[t.status]}</span>`
    + `<div class="body">${esc(t.name)}${extra}</div></div>`;
}

function resultSection(unitDir, r) {
  const when = new Date(r.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  const load = esc(`${unitDir}/${r.file}`);
  return `<h3>${esc(r.file)} <small>geprüft ${when}</small></h3>${r.tests.map(testRow).join('')}`
    + `<details><summary>Testdatei ansehen</summary><pre class="view" data-load="${load}"></pre></details>`;
}

async function renderResults(c, u) {
  const { results } = await api(`/api/results?unit=${encodeURIComponent(u.dir)}`);
  const command = esc(`node --test "${u.dir}/*.test.js"`);
  if (!results.length) {
    c.innerHTML = `<div class="results"><div class="note"><p>Diese Einheit wurde noch nicht geprüft.</p>
      <p>Klick oben auf <strong>Prüfen ▶</strong> oder tippe unten im Terminal: <code>${command}</code></p></div></div>`;
    return;
  }
  const legend = '<p class="legend">Bei Fehlern: Zeilen mit <b style="color:var(--err)">+</b> zeigen, was dein Code liefert,'
    + ' Zeilen mit <b style="color:var(--ok)">−</b>, was erwartet wird.</p>';
  c.innerHTML = `<div class="results">${legend}${results.map((r) => resultSection(u.dir, r)).join('')}</div>`;
  for (const d of c.querySelectorAll('details')) {
    d.addEventListener('toggle', async () => {
      const pre = d.querySelector('pre');
      if (d.open && !pre.textContent) pre.innerHTML = highlight(await readFile(pre.dataset.load), 'js');
    });
  }
}

async function renderSolution(c, u) {
  const files = u.files.filter((f) => f.kind === 'solution');
  const texts = await Promise.all(files.map((f) => readFile(`${u.dir}/${f.name}`)));
  const command = esc(`LOESUNG=1 node --test "${u.dir}/*.test.js"`);
  const blocks = files.map((f, k) => `<h3>${esc(f.name)}</h3><pre class="view solution">${highlight(texts[k], langForFile(f.name))}</pre>`).join('');
  c.innerHTML = `<div class="results"><div class="note"><p><strong>Musterlösung.</strong> Am meisten lernst du, wenn du es erst selbst versuchst
    und danach deine Version mit dieser vergleichst. Prüfen gegen die Lösung: <code>${command}</code></p></div>${blocks}</div>`;
}

async function renderUnit(c, u) {
  const tab = S.view.tab;
  if (tab.startsWith('file:')) return renderEditor(c, u, tab.slice(5));
  if (tab === 'results') return renderResults(c, u);
  if (tab === 'solution') return renderSolution(c, u);
  return renderReadme(c, u);
}

async function renderContent(c) {
  const v = S.view;
  if (!v.unit) return renderOverview(c);
  if (v.unit === '@spick') {
    c.innerHTML = `<div class="doc">${md(await readFile('spickzettel.md'), 'lernen')}</div>`;
    return undefined;
  }
  const u = unitByDir(v.unit);
  if (!tabsFor(u).some(([id]) => id === v.tab)) v.tab = 'readme';
  return renderUnit(c, u);
}

async function render() {
  if (S.view.unit && S.view.unit !== '@spick' && !unitByDir(S.view.unit)) S.view = { unit: null, tab: 'readme' };
  if (!S.view.tab?.startsWith('file:')) S.editor = null;
  renderNav();
  renderHead();
  const c = $('content');
  try {
    await renderContent(c);
    const target = S.view.anchor && document.getElementById(S.view.anchor);
    if (target) target.scrollIntoView();
    else c.scrollTop = 0;
    S.view.anchor = null;
  } catch (err) {
    c.innerHTML = `<div class="doc"><div class="note warn">${esc(err.message)}</div></div>`;
  }
}

async function go(view) {
  if (isDirty()) await save();
  S.view = view;
  store.set('view', { unit: view.unit, tab: view.tab });
  await render();
}

// ---------------------------------------------------------------------------
// Links inside explanations
// ---------------------------------------------------------------------------
async function openProjectFile(target, anchor) {
  try {
    const { content } = await api(`/api/repofile?path=${encodeURIComponent(target)}`);
    const base = target.split('/').slice(0, -1).join('/');
    $('modalTitle').textContent = target;
    const name = target.split('/').at(-1);
    $('modalBody').innerHTML = target.endsWith('.md') ? `<div class="doc">${md(content, base)}</div>` : `<pre class="view">${highlight(content, langForFile(name))}</pre>`;
    $('modal').classList.add('open');
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  } catch (err) {
    alert(err.message);
  }
}

/** Link to a file of a unit: its explanation, its exercise file or its solution. */
function unitLink(u, name, anchor) {
  if (!name || name === 'README.md') return { unit: u.dir, tab: 'readme', anchor };
  const file = u.files.find((f) => f.name === name);
  if (file?.kind === 'edit') return { unit: u.dir, tab: `file:${file.name}` };
  if (file?.kind === 'solution') return { unit: u.dir, tab: 'solution' };
  return null;
}

function followLink(target, anchor) {
  $('modal').classList.remove('open');
  if (target === 'lernen/README.md' || target === 'lernen') return go({ unit: null, tab: 'readme', anchor });
  if (target === 'lernen/spickzettel.md') return go({ unit: '@spick', tab: 'readme', anchor });
  const parts = target.split('/');
  const u = parts[0] === 'lernen' ? unitByDir(parts[1]) : null;
  const view = u ? unitLink(u, parts.slice(2).join('/'), anchor) : null;
  return view ? go(view) : openProjectFile(target, anchor);
}

// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------
async function refresh(rerender) {
  const st = await api('/api/state');
  S.units = st.units;
  S.workDir = st.workDir;
  S.node = st.node;
  term.setPrompt(st.prompt);
  if (rerender) {
    await render();
  } else {
    renderNav();
    renderHead();
  }
}

/** One line per unit whose tests just ran. */
async function reportUpdates(updated, line) {
  for (const up of updated) {
    const u = unitByDir(up.dir);
    const name = u ? `Einheit ${u.num} (${u.title})` : `Einheit ${up.dir.slice(0, 2)}`;
    if (up.pass === up.total) line(`✔ ${name}: alle ${up.total} Tests bestanden.`, 'a32');
    else line(`→ ${name}: ${up.pass} von ${up.total} Tests bestanden. Details im Tab „Ergebnis“.`, 'info');
  }
  if (!updated.length) return;
  const showsResults = S.view.tab === 'results' && updated.some((up) => up.dir === S.view.unit);
  await refresh(showsResults);
}

const term = createTerminal({
  els: {
    out: $('termOut'), input: $('termIn'), prompt: $('termPrompt'), stop: $('termStop'),
    clear: $('termClear'), state: $('termState'), where: $('where'), box: $('term'),
  },
  token: TOKEN,
  api,
  store,
  beforeRun: save,
  afterRun: reportUpdates,
});

/**
 * Prüfen: the same command the pupil could type, relative to the terminal's folder.
 * A glob pattern, because Node 24 no longer accepts a folder after "node --test".
 */
function checkUnit(dir) {
  const inside = term.folder().split('/').slice(1);
  const prefix = inside.length === 1 && inside[0] === dir ? '' : '../'.repeat(inside.length) + dir + '/';
  return term.typeAndRun(`node --test "${prefix}*.test.js"`);
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function closeModal() {
  $('modal').classList.remove('open');
}

function onDocumentClick(e) {
  const a = e.target.closest('a[data-target], a[data-anchor]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.target) {
    void followLink(a.dataset.target, a.dataset.anchor || null);
    return;
  }
  const scope = a.closest('.doc, .box-body, .content');
  scope?.querySelector(`#${CSS.escape(a.dataset.anchor)}`)?.scrollIntoView();
}

function onKey(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 's') {
    e.preventDefault();
    void save();
  } else if (mod && e.key === 'Enter' && unitByDir(S.view.unit)) {
    e.preventDefault();
    void checkUnit(S.view.unit);
  } else if (e.key === 'Escape') {
    closeModal();
  }
}

function setupResizer() {
  const box = $('term');
  const height = store.get('termHeight', null);
  if (height) box.style.height = `${height}px`;
  $('resizer').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = box.offsetHeight;
    const move = (ev) => {
      const h = Math.max(80, Math.min(window.innerHeight - 160, startH - (ev.clientY - startY)));
      box.style.height = `${h}px`;
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      store.set('termHeight', box.offsetHeight);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
}

function wire() {
  $('nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-unit]');
    if (!b) return;
    const unit = b.dataset.unit || null;
    const tab = unit === S.view.unit ? S.view.tab : store.get(`tab.${unit}`, 'readme');
    void go({ unit, tab });
  });
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    store.set(`tab.${S.view.unit}`, b.dataset.tab);
    void go({ unit: S.view.unit, tab: b.dataset.tab });
  });
  $('filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    S.filter = b.dataset.f;
    store.set('filter', S.filter);
    renderNav();
  });
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKey);
  $('modalClose').addEventListener('click', closeModal);
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
  addEventListener('beforeunload', (e) => { if (isDirty()) e.preventDefault(); });
  setupResizer();
}

function showFatal(html) {
  document.body.innerHTML = `<p style="padding:24px">${html}</p>`;
}

/** Warns when Node.js is missing or too old: the terminal needs it for node --test and npm. */
function nodeWarning() {
  if (!S.node) {
    term.info('Node.js wurde nicht gefunden. Ohne Node.js laufen keine Tests.');
    term.info('Installiere die LTS-Version von https://nodejs.org und starte das Lern-Cockpit danach neu.');
  } else if (S.node.major < 22) {
    term.info(`Node.js ${S.node.version} ist zu alt für die Tests. Bitte die aktuelle LTS-Version von https://nodejs.org installieren.`);
  }
}

async function main() {
  if (!TOKEN) {
    showFatal('Bitte die Adresse aus dem Fenster öffnen, in dem das Lern-Cockpit läuft.');
    return;
  }
  wire();
  try {
    await refresh(false);
  } catch (err) {
    showFatal(esc(err.message));
    return;
  }
  // Deep link: #01-js-werkzeuge, #01-js-werkzeuge/results, #01-js-werkzeuge/file:uebung.js
  const [hashUnit, hashTab] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (hashUnit && unitByDir(hashUnit)) S.view = { unit: hashUnit, tab: hashTab || 'readme' };
  term.info('Willkommen im Lern-Cockpit. Hier tippst du Befehle wie in einem echten Terminal.');
  term.info('Probier zum Beispiel:  node --test "01-js-werkzeuge/*.test.js"   ·   npm run lernen   ·   hilfe');
  nodeWarning();
  await render();
  $('termIn').focus();
}

// For the browser tests (scratch scripts call these through the console).
Object.assign(globalThis, { cockpit: { go, checkUnit, term, state: S } });

await main();
