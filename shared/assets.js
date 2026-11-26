// Reads a project file by its repo-relative path. Inside the single-file setup wizard
// (Node SEA) the files are embedded as assets; during development they are read from disk.
const fs = require('node:fs');
const path = require('node:path');

/** True inside a built single-file program (Node SEA). */
function isSea() {
  try {
    return require('node:sea').isSea();
  } catch {
    return false; // node:sea does not exist outside a SEA on older Node versions
  }
}

/**
 * Returns the file as text with LF line endings. On Windows, git (core.autocrlf) checks files
 * out with CRLF; the code that edits these texts (e.g. removing the require line from
 * src/planets.js for Node-RED) expects "\n".
 */
function readAsset(relPath) {
  const text = isSea()
    ? require('node:sea').getAsset(relPath, 'utf8')
    : fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
  return text.replace(/\r\n/g, '\n');
}

/** Every file the setup wizard needs at runtime (also the SEA asset list). */
const ASSET_FILES = [
  'src/planets.js',
  'db/schema.sql',
  'grafana/queries.sql',
  'grafana/solar-system.echarts.js',
  'node-red/functions/split-usgs.js',
  'node-red/functions/backfill-url.js',
  'node-red/functions/split-pending.js',
  'node-red/functions/pending-sql.js',
  'node-red/functions/compute-sky.js',
  'node-red/functions/plates-sql.js',
  'setup-wizard/ui.html',
];

module.exports = { readAsset, isSea, ASSET_FILES };
