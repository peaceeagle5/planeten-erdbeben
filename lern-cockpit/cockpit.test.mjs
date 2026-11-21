// Tests for the parts of the Lern-Cockpit that need no browser and no server:
// Markdown rendering and the terminal's colour parsing.
//   node --test lern-cockpit/
import test from 'node:test';
import assert from 'node:assert/strict';
import { md, inline, cells, listMarker, joinPath } from './ui/markdown.mjs';
import { parseAnsi, commonPrefix, PLAIN } from './ui/terminal.mjs';
import { highlight, langForFile } from './ui/highlight.mjs';

const ESC = String.fromCodePoint(27);

test('Markdown: Überschrift, Absatz, Code, fett', () => {
  assert.equal(md('# Titel', ''), '<h1 id="titel">Titel</h1>');
  assert.equal(inline('**fett** und `a < b`', ''), '<strong>fett</strong> und <code>a &lt; b</code>');
  assert.equal(inline('``Backtick ` drin``', ''), '<code>Backtick ` drin</code>');
  assert.equal(md('eins\nzwei', ''), '<p>eins zwei</p>');
});

test('Markdown: kein HTML aus dem Text', () => {
  assert.equal(inline('<script>x</script>', ''), '&lt;script&gt;x&lt;/script&gt;');
  assert.equal(inline('a<br>b', ''), 'a<br>b');
});

test('Markdown: Links', () => {
  assert.equal(
    inline('[Einheit 2](../02-module-npm/README.md#ziele)', 'lernen/01-js-werkzeuge'),
    '<a href="#" data-target="lernen/02-module-npm/README.md" data-anchor="ziele">Einheit 2</a>',
  );
  assert.match(inline('[Node](https://nodejs.org)', ''), /target="_blank"/);
  assert.equal(joinPath('lernen/01', '../../app.js'), 'app.js');
});

test('Markdown: Listen, auch verschachtelt und mit Code', () => {
  assert.equal(md('- a\n- b', ''), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(md('3. drei\n4. vier', ''), '<ol start="3"><li>drei</li><li>vier</li></ol>');
  const nested = md('- a\n  - a1\n- b', '');
  assert.equal(nested, '<ul><li>a\n<ul><li>a1</li></ul></li><li>b</li></ul>');
  assert.match(md('1. Befehl:\n   ```\n   npm install\n   ```', ''), /<li>Befehl:\n<pre data-lang=""><code>npm install<\/code><\/pre><\/li>/);
  assert.deepEqual(listMarker('  12. Text'), { indent: 2, width: 4, ordered: true, num: 12, text: 'Text' });
  assert.equal(listMarker('-kein Punkt'), null);
});

test('Markdown: Tabellen, | in Code bleibt', () => {
  assert.deepEqual(cells('| `a || b` | c \\| d |'), ['`a || b`', 'c | d']);
  const html = md('| A | B |\n|---|--:|\n| 1 | 2 |', '');
  assert.equal(html, '<table><thead><tr><th>A</th><th style="text-align:right">B</th></tr></thead>'
    + '<tbody><tr><td>1</td><td style="text-align:right">2</td></tr></tbody></table>');
});

test('Markdown: Zitat, Linie, Codeblock', () => {
  assert.equal(md('> **Tipp:** so', ''), '<blockquote><p><strong>Tipp:</strong> so</p></blockquote>');
  assert.equal(md('---', ''), '<hr>');
  assert.equal(md('```\na < b\n```', ''), '<pre data-lang=""><code>a &lt; b</code></pre>');
  assert.match(md('```js\nconst a = 1;\n```', ''), /<code><span class="t-kw">const<\/span>/);
});

test('Terminal: Farben werden zu CSS-Klassen', () => {
  const { segments, style } = parseAnsi(`${ESC}[32m✔ ok${ESC}[39m fertig`, PLAIN);
  assert.deepEqual(segments, [{ text: '✔ ok', cls: 'a32' }, { text: ' fertig', cls: '' }]);
  assert.equal(style.fg, null);
  const bold = parseAnsi(`${ESC}[1;31mFehler`, PLAIN);
  assert.deepEqual(bold.segments, [{ text: 'Fehler', cls: 'a31 a1' }]);
});

test('Terminal: abgeschnittene Escape-Folge wartet auf den nächsten Teil', () => {
  const first = parseAnsi(`Hallo ${ESC}[3`, PLAIN);
  assert.equal(first.carry, `${ESC}[3`);
  assert.deepEqual(first.segments, [{ text: 'Hallo ', cls: '' }]);
  const second = parseAnsi(`${first.carry}1mrot`, first.style);
  assert.deepEqual(second.segments, [{ text: 'rot', cls: 'a31' }]);
});

test('Terminal: gemeinsamer Anfang für die Tab-Ergänzung', () => {
  assert.equal(commonPrefix(['01-js-werkzeuge/', '02-module-npm/']), '0');
  assert.equal(commonPrefix(['uebung.js', 'uebung.test.js']), 'uebung.');
  assert.equal(commonPrefix([]), '');
});

test('Syntaxfarben wie in der Markdown-Vorschau: JavaScript', () => {
  const html = highlight('const s = `Hallo ${food.name}`; // Gruß\nformatFood(food.name, 52, true);\nconsole.log(require("x"));', 'js');
  assert.match(html, /<span class="t-kw">const<\/span>/);
  assert.match(html, /<span class="t-str">`Hallo <\/span><span class="t-subst">\$\{food.name\}<\/span><span class="t-str">`<\/span>/);
  assert.match(html, /<span class="t-com">\/\/ Gruß<\/span>/);
  assert.match(html, /<span class="t-title">formatFood<\/span>\(food.name, <span class="t-num">52<\/span>, <span class="t-lit">true<\/span>\)/);
  assert.match(html, /<span class="t-var">console<\/span>.<span class="t-title">log<\/span>\(<span class="t-bi">require<\/span>/);
  assert.equal(highlight('a < b', 'js'), 'a &lt; b');
});

test('Syntaxfarben: SQL, Dockerfile, Antwortdateien', () => {
  const sql = highlight("select COUNT(*) from planets -- alle\nWHERE id = 'x'", 'sql');
  assert.match(sql, /t-kw">select<.*t-bi">COUNT<.*t-kw">from<.*t-com">-- alle<.*t-kw">WHERE<.*t-str">'x'</s);
  assert.match(highlight('FROM node:24\n# Basis\nRUN npm ci', 'dockerfile'), /t-kw">FROM<.*t-com"># Basis<.*t-kw">RUN</s);
  assert.equal(highlight('# Frage\nport-grafana: 3000', 'answers'),
    '<span class="t-com"># Frage</span>\n<span class="t-attr">port-grafana</span>:<span class="t-str"> 3000</span>');
  assert.equal(highlight('<b>', 'unbekannt'), '&lt;b&gt;');
  assert.equal(langForFile('uebung.js'), 'js');
  assert.equal(langForFile('loesung.Dockerfile'), 'dockerfile');
  assert.equal(langForFile('befehle.txt'), 'answers');
});
