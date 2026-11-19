// Einheit 08 – Musterlösung

function interpolate(sql, vars) {
  return sql.replace(/\$\{?(\w+)\}?/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

function expandTimeFilter(sql, from, to) {
  const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  return sql.replace(/\$__timeFilter\((\w+)\)/g, (whole, col) => `${col} BETWEEN '${fmt(from)}' AND '${fmt(to)}'`);
}

function loadQueries(text) {
  const lines = text.split('\n');
  const queries = {};
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/^-- (\d+)\) /);
    if (header && /^-- =+/.test(lines[i - 1] || '')) {
      current = Number(header[1]);
      queries[current] = [];
      while (i + 1 < lines.length && lines[i + 1].startsWith('--')) i++; // Rest des Kopfes überspringen
      continue;
    }
    if (current && !lines[i].startsWith('--')) queries[current].push(lines[i]);
  }
  for (const k of Object.keys(queries)) queries[k] = queries[k].join('\n').trim().replace(/;$/, '');
  return queries;
}

function makePanel(id, title, type, sql) {
  return { id, title, type, targets: [{ refId: 'A', rawSql: sql, format: 'table', rawQuery: true }] };
}

module.exports = { interpolate, expandTimeFilter, loadQueries, makePanel };
