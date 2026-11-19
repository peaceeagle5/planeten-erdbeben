// Einheit 13 – Musterlösung

function isIgnored(filePath, patterns) {
  const parts = filePath.split('/');
  const name = parts.at(-1);
  return patterns
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#'))
    .some((p) => {
      if (p.endsWith('/')) return parts.slice(0, -1).includes(p.slice(0, -1)); // Ordner irgendwo im Pfad
      if (p.startsWith('*.')) return name.endsWith(p.slice(1));                // Endung
      if (p.includes('/')) return filePath === p;                             // genauer Pfad
      return name === p;                                                       // Dateiname überall
    });
}

function parseStatus(porcelain) {
  const result = { staged: [], modified: [], untracked: [] };
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue;
    const x = line[0];
    const y = line[1];
    const file = line.slice(3);
    if (x === '?' && y === '?') { result.untracked.push(file); continue; }
    if (x === 'M' || x === 'A') result.staged.push(file);
    if (y === 'M') result.modified.push(file);
  }
  return result;
}

function suspiciousFiles(paths) {
  return paths.filter((p) => {
    const name = p.split('/').at(-1).toLowerCase();
    return name === '.env' || /(_cred\.json|\.pem|\.key)$/.test(name) || name.includes('password');
  });
}

function resolveConflict(text, keep) {
  const out = [];
  let part = null; // null = außerhalb, 'ours', 'theirs'
  for (const line of text.split('\n')) {
    if (line.startsWith('<<<<<<<')) { part = 'ours'; continue; }
    if (line.startsWith('=======') && part === 'ours') { part = 'theirs'; continue; }
    if (line.startsWith('>>>>>>>') && part === 'theirs') { part = null; continue; }
    if (part === null || part === keep) out.push(line);
  }
  return out.join('\n');
}

function goodCommitMessage(message) {
  const first = String(message || '').split('\n')[0].trim();
  const lazy = ['fix', 'update', 'changes', 'änderungen', 'wip', 'asdf'];
  return first.length >= 10 && first.length <= 72 && !lazy.includes(first.toLowerCase().replace(/\.$/, ''));
}

module.exports = { isIgnored, parseStatus, suspiciousFiles, resolveConflict, goodCommitMessage };
