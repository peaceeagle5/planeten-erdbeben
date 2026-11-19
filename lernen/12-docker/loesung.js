// Einheit 12 – Musterlösung

function parseImage(image) {
  const lastSlash = image.lastIndexOf('/');
  const colon = image.indexOf(':', lastSlash + 1); // nur ein ':' nach dem letzten '/' ist ein Tag
  if (colon === -1) return { repository: image, tag: 'latest' };
  return { repository: image.slice(0, colon), tag: image.slice(colon + 1) };
}

function isPinned(image) {
  return parseImage(image).tag !== 'latest';
}

function parsePort(spec) {
  const parts = String(spec).split(':');
  if (parts.length === 3) return { hostIp: parts[0], hostPort: Number(parts[1]), containerPort: Number(parts[2]) };
  if (parts.length === 2) return { hostIp: '0.0.0.0', hostPort: Number(parts[0]), containerPort: Number(parts[1]) };
  return { hostIp: '0.0.0.0', hostPort: Number(parts[0]), containerPort: Number(parts[0]) };
}

function onlyLocal(spec) {
  return parsePort(spec).hostIp === '127.0.0.1';
}

function expandVars(text, env) {
  return text.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (whole, name, fallback) => env[name] || fallback || '');
}

function dbAddress(who) {
  return who === 'container' ? 'mariadb:3306' : '127.0.0.1:3306';
}

module.exports = { parseImage, isPinned, parsePort, onlyLocal, expandVars, dbAddress };
