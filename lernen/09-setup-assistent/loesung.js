// Einheit 09 – Musterlösung

function baseUrl(url) {
  let u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u;
}

function basicAuth(user, password) {
  return 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
}

function decodeBasic(header) {
  const text = Buffer.from(header.replace(/^Basic /, ''), 'base64').toString('utf8');
  const i = text.indexOf(':');
  return { user: text.slice(0, i), password: text.slice(i + 1) };
}

function slug(name) {
  return String(name || '').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // 'ü' → 'u' + Pünktchen → 'u'
    .replace(/[^a-z0-9]+/g, '-').slice(0, 28).replace(/^-|-$/g, '') || 'user';
}

function ownerFromInfo(info) {
  const m = String(info || '').match(/^Eingerichtet von: (.+?)(?: \(\d{4}-\d{2}-\d{2}\))?$/m);
  return m ? m[1] : null;
}

function isAllowedHost(hostHeader, port) {
  return hostHeader === `127.0.0.1:${port}` || hostHeader === `localhost:${port}`;
}

function parseNdjson(chunks) {
  const out = [];
  let buf = '';
  for (const chunk of chunks) {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) out.push(JSON.parse(line));
    }
  }
  return out;
}

module.exports = { baseUrl, basicAuth, decodeBasic, slug, ownerFromInfo, isAllowedHost, parseNdjson };
