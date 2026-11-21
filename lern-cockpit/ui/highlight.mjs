// Syntax highlighting like VS Code's Markdown preview (highlight.js with the "vs" / "vs2015" styles):
// keywords, literals, strings, numbers, comments, built-ins, function names and ${…} in template strings
// get CSS classes (t-kw, t-str ...); ui.html colours them for light and dark mode.
// A small scanner, no library: it only has to look right for the files in lernen/
// (JavaScript, SQL, Dockerfile, answer files) and the code blocks in the READMEs.
import { esc } from './html.mjs';

const words = (text) => new Set(text.split(/\s+/).filter(Boolean));

// The same word groups highlight.js uses for JavaScript.
const JS = {
  lineComment: '//',
  blockComment: true,
  quotes: '\'"',
  template: true,
  keywords: words(`const let var function return if else for while do of in new class extends import export from
    default async await try catch finally throw typeof instanceof switch case break continue delete void yield
    static get set as`),
  literals: words('true false null undefined NaN Infinity'),
  builtins: words(`require exports setTimeout setInterval clearTimeout clearInterval parseInt parseFloat isNaN isFinite
    Object Array JSON Math Promise Number String Boolean Date Error TypeError Map Set Symbol RegExp BigInt Intl`),
  variables: words('console this module global window document arguments super'),
  types: words(''),
};

const SQL = {
  lineComment: '--',
  blockComment: true,
  quotes: '\'"`',
  caseInsensitive: true,
  keywords: words(`SELECT FROM WHERE AND OR NOT IN IS AS JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT
    OFFSET INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE PRIMARY KEY FOREIGN REFERENCES INDEX UNIQUE DEFAULT
    IGNORE REPLACE DISTINCT BETWEEN LIKE CASE WHEN THEN ELSE END ASC DESC DATABASE USE GRANT DROP ALTER ADD COLUMN
    IF EXISTS AUTO_INCREMENT UNION ALL WITH VIEW TO PRIVILEGES IDENTIFIED USER`),
  literals: words('TRUE FALSE NULL'),
  builtins: words('COUNT SUM AVG MIN MAX FLOOR CEIL ROUND ABS NOW CONCAT COALESCE LOWER UPPER DATE YEAR MONTH DAY HOUR'),
  variables: words(''),
  types: words('INT INTEGER BIGINT SMALLINT TINYINT VARCHAR CHAR TEXT DOUBLE FLOAT DECIMAL DATETIME TIMESTAMP BOOLEAN'),
};

const DOCKER = {
  lineComment: '#',
  quotes: '\'"',
  keywords: words('FROM RUN COPY ADD WORKDIR CMD ENTRYPOINT ENV ARG EXPOSE USER LABEL VOLUME HEALTHCHECK AS'),
  literals: words(''),
  builtins: words(''),
  variables: words(''),
  types: words(''),
};

const SHELL = {
  lineComment: '#',
  quotes: '\'"',
  keywords: words('if then else fi for do done while case esac function in'),
  literals: words('true false'),
  builtins: words('cd echo export source sudo'),
  variables: words(''),
  types: words(''),
};

const LANGS = {
  js: JS, javascript: JS, mjs: JS, json: JS,
  sql: SQL,
  dockerfile: DOCKER, docker: DOCKER,
  bash: SHELL, sh: SHELL, shell: SHELL, yaml: SHELL, yml: SHELL, powershell: SHELL,
};

/** Language for a file name: uebung.js → js, uebung.sql → sql, antworten.txt → answers ... */
export function langForFile(name) {
  if (/\.(m?js|json)$/.test(name)) return 'js';
  if (name.endsWith('.sql')) return 'sql';
  if (/(^|\.)Dockerfile$/.test(name)) return 'dockerfile';
  if (name.endsWith('.txt')) return 'answers';
  return '';
}

const wrap = (cls, html) => `<span class="t-${cls}">${html}</span>`;
const span = (cls, text) => wrap(cls, esc(text));
const isSpace = (c) => c === ' ' || c === '\t' || c === '\n';
const isDigit = (c) => c >= '0' && c <= '9';
const isIdStart = (c) => /[A-Za-z_$]/.test(c);
const isIdChar = (c) => /[\w$]/.test(c);

function skip(s, i, test) {
  let j = i;
  while (j < s.length && test(s[j])) j += 1;
  return j;
}

function stringEnd(s, i) {
  const quote = s[i];
  let j = i + 1;
  while (j < s.length && s[j] !== quote) j += s[j] === '\\' ? 2 : 1;
  return Math.min(j + 1, s.length);
}

function lineEnd(s, i) {
  const end = s.indexOf('\n', i);
  return end < 0 ? s.length : end;
}

function blockCommentEnd(s, i) {
  const end = s.indexOf('*/', i + 2);
  return end < 0 ? s.length : end + 2;
}

/** Index after the "}" that closes the "${" at i (nested braces counted). */
function substEnd(s, i) {
  let depth = 0;
  let j = i + 2;
  while (j < s.length) {
    if (s[j] === '{') depth += 1;
    if (s[j] === '}') {
      if (depth === 0) return j + 1;
      depth -= 1;
    }
    j += 1;
  }
  return s.length;
}

/** `text ${expr} text`: the text parts are strings, the ${…} parts are highlighted code. */
function templateToken(s, i, lang) {
  let html = '';
  let text = '`';
  let j = i + 1;
  while (j < s.length && s[j] !== '`') {
    if (s.startsWith('${', j)) {
      const end = substEnd(s, j);
      html += span('str', text) + wrap('subst', `\${${highlightCode(s.slice(j + 2, end - 1), lang)}}`);
      text = '';
      j = end;
    } else {
      const step = s[j] === '\\' ? 2 : 1;
      text += s.slice(j, j + step);
      j += step;
    }
  }
  const end = Math.min(j + 1, s.length);
  return { html: html + span('str', text + s.slice(j, end)), end };
}

/** "#" starts a comment only at the start of a line or after a space (not in URLs like a#b). */
function isLineComment(s, i, lang) {
  if (!lang.lineComment || !s.startsWith(lang.lineComment, i)) return false;
  return lang.lineComment !== '#' || i === 0 || isSpace(s[i - 1]);
}

/** Class of a word: keyword, literal, built-in, language variable, type, function name or none. */
function wordClass(word, lang, followedByParen) {
  const key = lang.caseInsensitive ? word.toUpperCase() : word;
  if (lang.literals.has(key)) return 'lit';
  if (lang.keywords.has(key)) return 'kw';
  if (lang.builtins.has(key)) return 'bi';
  if (lang.variables.has(key)) return 'var';
  if (lang.types.has(key)) return 'type';
  return followedByParen ? 'title' : '';
}

function wordToken(s, i, lang) {
  const end = skip(s, i, isIdChar);
  const isCall = s[skip(s, end, (c) => c === ' ')] === '(';
  const after = s[i - 1] === '.';
  const cls = after && !isCall ? '' : wordClass(s.slice(i, end), lang, isCall);
  return { cls, end };
}

/** The token starting at i: { cls, end } or { html, end } for already highlighted parts. */
function nextToken(s, i, lang) {
  const c = s[i];
  if (isLineComment(s, i, lang)) return { cls: 'com', end: lineEnd(s, i) };
  if (lang.blockComment && s.startsWith('/*', i)) return { cls: 'com', end: blockCommentEnd(s, i) };
  if (lang.template && c === '`') return templateToken(s, i, lang);
  if (lang.quotes.includes(c)) return { cls: 'str', end: stringEnd(s, i) };
  if (isDigit(c)) return { cls: 'num', end: skip(s, i, (x) => isIdChar(x) || x === '.') };
  if (isIdStart(c)) return wordToken(s, i, lang);
  if (isSpace(c)) return { cls: '', end: skip(s, i, isSpace) };
  return { cls: '', end: i + 1 };
}

function highlightCode(s, lang) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const token = nextToken(s, i, lang);
    if (token.html === undefined) {
      const text = s.slice(i, token.end);
      out += token.cls ? span(token.cls, text) : esc(text);
    } else {
      out += token.html;
    }
    i = token.end;
  }
  return out;
}

/** Answer files: "# comment" lines, "key: answer" lines (like keys and values in JSON). */
function highlightAnswers(s) {
  return s.split('\n').map((line) => {
    if (line.trimStart().startsWith('#')) return span('com', line);
    const colon = line.indexOf(':');
    if (colon < 0) return esc(line);
    return span('attr', line.slice(0, colon)) + esc(':') + span('str', line.slice(colon + 1));
  }).join('\n');
}

/** HTML with coloured spans. lang: js, sql, dockerfile, answers, bash ... (unknown: only escaped). */
export function highlight(code, lang) {
  const name = String(lang || '').toLowerCase();
  if (name === 'answers') return highlightAnswers(code);
  const spec = LANGS[name];
  return spec ? highlightCode(code, spec) : esc(code);
}
