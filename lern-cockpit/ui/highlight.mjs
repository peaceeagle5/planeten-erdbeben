// Syntax highlighting in the colours of the VS Code theme "Claude Code Mono":
// keywords, strings, numbers, comments, function names and properties get CSS classes (t-kw, t-str ...),
// ui.html colours them for light and dark mode. A small scanner, no library: it only has to look right
// for the files in lernen/ (JavaScript, SQL, Dockerfile, answer files) and the code blocks in the READMEs.
import { esc } from './html.mjs';

const words = (text) => new Set(text.split(/\s+/));

const JS = {
  lineComment: '//',
  blockComment: true,
  quotes: '\'"`',
  keywords: words(`const let var function return if else for while do of in new class extends import export from
    default async await try catch finally throw typeof instanceof switch case break continue this delete void yield
    static get set`),
  constants: words('true false null undefined NaN Infinity'),
};

const SQL = {
  lineComment: '--',
  blockComment: true,
  quotes: '\'"`',
  caseInsensitive: true,
  keywords: words(`SELECT FROM WHERE AND OR NOT IN IS AS JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT
    OFFSET INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE PRIMARY KEY FOREIGN REFERENCES INDEX UNIQUE DEFAULT
    IGNORE REPLACE DISTINCT BETWEEN LIKE CASE WHEN THEN ELSE END ASC DESC DATABASE USE GRANT DROP ALTER ADD COLUMN
    IF EXISTS INT INTEGER VARCHAR TEXT DOUBLE FLOAT DECIMAL DATETIME TIMESTAMP BOOLEAN AUTO_INCREMENT UNION ALL WITH
    VIEW TO PRIVILEGES IDENTIFIED USER`),
  constants: words('TRUE FALSE NULL'),
};

const DOCKER = {
  lineComment: '#',
  quotes: '\'"',
  keywords: words('FROM RUN COPY ADD WORKDIR CMD ENTRYPOINT ENV ARG EXPOSE USER LABEL VOLUME HEALTHCHECK AS'),
  constants: words(''),
};

const SHELL = {
  lineComment: '#',
  quotes: '\'"',
  keywords: words(''),
  constants: words('true false null'),
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

const span = (cls, text) => `<span class="t-${cls}">${esc(text)}</span>`;
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

/** "#" starts a comment only at the start of a line or after a space (not in URLs like a#b). */
function isLineComment(s, i, lang) {
  if (!lang.lineComment || !s.startsWith(lang.lineComment, i)) return false;
  return lang.lineComment !== '#' || i === 0 || isSpace(s[i - 1]);
}

function wordToken(s, i, lang) {
  const end = skip(s, i, isIdChar);
  const word = s.slice(i, end);
  const key = lang.caseInsensitive ? word.toUpperCase() : word;
  if (lang.constants.has(key)) return ['const', end];
  if (lang.keywords.has(key)) return ['kw', end];
  if (s[skip(s, end, (c) => c === ' ')] === '(') return ['fn', end];
  if (s[i - 1] === '.') return ['prop', end];
  return ['', end];
}

/** [css class or '', end index] of the token starting at i. */
function nextToken(s, i, lang) {
  const c = s[i];
  if (isLineComment(s, i, lang)) return ['com', lineEnd(s, i)];
  if (lang.blockComment && s.startsWith('/*', i)) return ['com', blockCommentEnd(s, i)];
  if (lang.quotes.includes(c)) return ['str', stringEnd(s, i)];
  if (isDigit(c)) return ['num', skip(s, i, (x) => isIdChar(x) || x === '.')];
  if (isIdStart(c)) return wordToken(s, i, lang);
  if (isSpace(c)) return ['', skip(s, i, isSpace)];
  return ['punc', i + 1];
}

function highlightCode(s, lang) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const [cls, end] = nextToken(s, i, lang);
    const text = s.slice(i, end);
    out += cls ? span(cls, text) : esc(text);
    i = end;
  }
  return out;
}

/** Answer files: "# comment" lines, "key: answer" lines. */
function highlightAnswers(s) {
  return s.split('\n').map((line) => {
    if (line.trimStart().startsWith('#')) return span('com', line);
    const colon = line.indexOf(':');
    if (colon < 0) return esc(line);
    return span('prop', line.slice(0, colon)) + span('punc', ':') + span('str', line.slice(colon + 1));
  }).join('\n');
}

/** HTML with coloured spans. lang: js, sql, dockerfile, answers, bash ... (unknown: only escaped). */
export function highlight(code, lang) {
  const name = String(lang || '').toLowerCase();
  if (name === 'answers') return highlightAnswers(code);
  const spec = LANGS[name];
  return spec ? highlightCode(code, spec) : esc(code);
}
