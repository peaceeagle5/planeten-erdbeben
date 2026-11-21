// Markdown → HTML for the explanations. Only what the READMEs in lernen/ use:
// headings, paragraphs, lists (nested), code blocks, quotes, tables, rules, `code`, **bold**, *italic*, links.
// No DOM needed, so it is tested with node --test (see ../cockpit.test.mjs).
import { esc } from './html.mjs';
import { highlight } from './highlight.mjs';

export { esc };

// Code spans are cut out first and put back at the end, so nothing inside them is formatted.
// Private-use characters mark the spots; they never appear in the READMEs.
const CODE_START = '';
const CODE_END = '';
const CODE_MARK = /(\d+)/g;

export const slug = (s) => s.toLowerCase()
  .replaceAll(/<[^>]*>/g, '')
  .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
  .trim()
  .replaceAll(/\s/g, '-');

/** Resolves a relative link against the folder of the current file (both relative to the project). */
export function joinPath(base, href) {
  const parts = base ? base.split('/') : [];
  for (const seg of href.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

/** Replaces `code` and ``co`de`` by markers and collects the code texts. */
function extractCode(s, codes) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] !== '`') {
      out += s[i];
      i += 1;
      continue;
    }
    let n = 0;
    while (s[i + n] === '`') n += 1;
    const fence = '`'.repeat(n);
    const end = s.indexOf(fence, i + n);
    if (end < 0) {
      out += fence;
      i += n;
      continue;
    }
    let code = s.slice(i + n, end);
    if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
    codes.push(code);
    out += CODE_START + (codes.length - 1) + CODE_END;
    i = end + n;
  }
  return out;
}

function link(text, href, base) {
  const h = href.replaceAll('&amp;', '&');
  if (/^https?:/.test(h)) return `<a href="${esc(h)}" target="_blank" rel="noopener">${text}</a>`;
  if (h.startsWith('#')) return `<a href="#" data-anchor="${esc(h.slice(1))}">${text}</a>`;
  const [file, anchor = ''] = h.split('#');
  const target = esc(joinPath(base, file));
  return `<a href="#" data-target="${target}" data-anchor="${esc(anchor)}">${text}</a>`;
}

/** Formats one line or paragraph of text. */
export function inline(s, base) {
  const codes = [];
  const html = esc(extractCode(s, codes))
    .replaceAll(/&lt;br ?\/?&gt;/g, '<br>')
    .replaceAll(/&lt;sup&gt;([^&]*)&lt;\/sup&gt;/g, '<sup>$1</sup>')
    .replaceAll(/\[([^[\]]+)\]\(([^()\s]+)\)/g, (_, text, href) => link(text, href, base))
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replaceAll(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
  return html.replaceAll(CODE_MARK, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
}

// ---------------------------------------------------------------------------
// Line types
// ---------------------------------------------------------------------------

const indentOf = (line) => line.length - line.trimStart().length;
const isFence = (line) => line.trimStart().startsWith('```');
const isRule = (line) => ['---', '***'].includes(line.trim());
const isQuote = (line) => line.trimStart().startsWith('>');
const isTableRow = (line) => line.trimStart().startsWith('|');
const isTableSep = (line) => /^:?-{2,}/.test(line.trim().replace(/^\|/, '').trimStart());
const HEADING = /^(#{1,6}) (.*)$/;

/** List item marker ("- ", "* ", "12. ") or null. */
export function listMarker(line) {
  const rest = line.trimStart();
  const m = /^([-*]|\d{1,4}\.) (.*)$/.exec(rest);
  if (!m) return null;
  const text = m[2].trimStart();
  return {
    indent: line.length - rest.length,
    width: m[1].length + 1 + (m[2].length - text.length),
    ordered: m[1] !== '-' && m[1] !== '*',
    num: Number.parseInt(m[1], 10),
    text,
  };
}

/** Splits a table row at "|", but not inside `code`; "\|" is a literal pipe. */
export function cells(row) {
  const out = [];
  let cur = '';
  let tick = false;
  const r = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < r.length; i += 1) {
    const c = r[i];
    if (c === '\\' && r[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (c === '|' && !tick) {
      out.push(cur.trim());
      cur = '';
    } else {
      if (c === '`') tick = !tick;
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

// ---------------------------------------------------------------------------
// Blocks: each takes (lines, index, base) and returns [html, next index]
// ---------------------------------------------------------------------------

function fenceBlock(lines, i) {
  const lang = lines[i].trim().slice(3).trim();
  const buf = [];
  let j = i + 1;
  while (j < lines.length && lines[j].trim() !== '```') {
    buf.push(lines[j]);
    j += 1;
  }
  return [`<pre data-lang="${esc(lang)}"><code>${highlight(buf.join('\n'), lang)}</code></pre>`, j + 1];
}

function headingBlock(lines, i, base) {
  const [, hashes, text] = HEADING.exec(lines[i]);
  const tag = `h${hashes.length}`;
  return [`<${tag} id="${esc(slug(text))}">${inline(text, base)}</${tag}>`, i + 1];
}

function quoteBlock(lines, i, base) {
  const buf = [];
  let j = i;
  while (j < lines.length && isQuote(lines[j])) {
    const text = lines[j].trimStart().slice(1);
    buf.push(text.startsWith(' ') ? text.slice(1) : text);
    j += 1;
  }
  return [`<blockquote>${md(buf.join('\n'), base)}</blockquote>`, j];
}

function alignOf(cell) {
  if (/^:-+:$/.test(cell)) return 'center';
  if (cell.endsWith(':')) return 'right';
  return '';
}

function cellHtml(tag, text, align, base) {
  const style = align ? ` style="text-align:${align}"` : '';
  return `<${tag}${style}>${inline(text, base)}</${tag}>`;
}

function tableBlock(lines, i, base) {
  const head = cells(lines[i]);
  const align = cells(lines[i + 1]).map(alignOf);
  const rows = [];
  let j = i + 2;
  while (j < lines.length && isTableRow(lines[j])) {
    rows.push(cells(lines[j]));
    j += 1;
  }
  const row = (r, tag) => r.map((c, k) => cellHtml(tag, c, align[k], base)).join('');
  const body = rows.map((r) => `<tr>${row(r, 'td')}</tr>`).join('');
  return [`<table><thead><tr>${row(head, 'th')}</tr></thead><tbody>${body}</tbody></table>`, j];
}

/** A blank line stays inside a list when the next line continues it. */
function continuesList(line, next) {
  if (line.trim()) return listMarker(line) !== null || indentOf(line) > 0;
  return listMarker(next) !== null || (next.trim() !== '' && indentOf(next) > 0);
}

function renderList(lines, base) {
  const first = listMarker(lines[0]);
  const items = [];
  for (const line of lines) {
    const m = listMarker(line);
    if (m && m.indent <= first.indent + 1) {
      items.push({ off: m.indent + m.width, lines: [m.text] });
    } else if (items.length) {
      const item = items.at(-1);
      item.lines.push(line.slice(Math.min(item.off, indentOf(line))));
    }
  }
  const lis = items.map((item) => {
    const inner = item.lines.length === 1
      ? inline(item.lines[0], base)
      : md(item.lines.join('\n'), base).replace(/^<p>([^]*?)<\/p>/, '$1');
    return `<li>${inner}</li>`;
  }).join('');
  const tag = first.ordered ? 'ol' : 'ul';
  const start = first.ordered && first.num !== 1 ? ` start="${first.num}"` : '';
  return `<${tag}${start}>${lis}</${tag}>`;
}

function listBlock(lines, i, base) {
  let j = i;
  while (j < lines.length && continuesList(lines[j], lines[j + 1] ?? '')) j += 1;
  return [renderList(lines.slice(i, j), base), j];
}

const BLOCKS = [
  [(line) => isFence(line), fenceBlock],
  [(line) => HEADING.test(line), headingBlock],
  [(line) => isRule(line), (lines, i) => ['<hr>', i + 1]],
  [(line) => isQuote(line), quoteBlock],
  [(line, next) => isTableRow(line) && isTableSep(next), tableBlock],
  [(line) => listMarker(line) !== null, listBlock],
];

const startsBlock = (line) => isTableRow(line) || BLOCKS.some(([test]) => test(line, ''));

function paragraphBlock(lines, i, base) {
  const buf = [lines[i]];
  let j = i + 1;
  while (j < lines.length && lines[j].trim() && !startsBlock(lines[j])) {
    buf.push(lines[j]);
    j += 1;
  }
  return [`<p>${inline(buf.join('\n'), base).replaceAll('\n', ' ')}</p>`, j];
}

/** Converts Markdown to HTML. base: folder of the file, relative to the project (for links). */
export function md(text, base) {
  const lines = text.replaceAll('\r', '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim()) {
      const block = BLOCKS.find(([test]) => test(lines[i], lines[i + 1] ?? ''));
      const [html, next] = (block ? block[1] : paragraphBlock)(lines, i, base);
      out.push(html);
      i = next;
    } else {
      i += 1;
    }
  }
  return out.join('\n');
}
