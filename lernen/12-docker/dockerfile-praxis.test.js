// Einheit 12 – Dockerfile (ohne JavaScript: du schreibst die Datei "Dockerfile")
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Dockerfile für die Planeten-API', (t) => {
  const file = process.env.LOESUNG ? 'loesung.Dockerfile' : 'Dockerfile';
  const lines = fs.readFileSync(path.join(__dirname, file), 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) { t.skip('noch offen: die Vorlage enthält nur Kommentare'); return; }
  const has = (re, msg) => assert.ok(lines.some((l) => re.test(l)), msg);
  const index = (re) => lines.findIndex((l) => re.test(l));
  has(/^FROM node:24-alpine$/i, 'TODO 1: FROM node:24-alpine');
  has(/^WORKDIR \/app$/i, 'TODO 2: WORKDIR /app');
  has(/^COPY package\*\.json \.\/?$/i, 'TODO 3: COPY package*.json ./');
  has(/^RUN npm ci --omit=dev$/i, 'TODO 4: RUN npm ci --omit=dev');
  has(/^COPY src \.\/src\/?$/i, 'TODO 5: COPY src ./src');
  has(/^COPY app\.js \.\/?$/i, 'TODO 5: COPY app.js ./');
  has(/^ENV PORT=3001$/i, 'TODO 6: ENV PORT=3001');
  has(/^EXPOSE 3001$/i, 'TODO 6: EXPOSE 3001');
  has(/^USER node$/i, 'TODO 7: USER node');
  has(/^CMD \["node",\s*"app\.js"\]$/i, 'TODO 8: CMD ["node", "app.js"]');
  assert.ok(index(/^COPY package/i) < index(/^RUN npm ci/i), 'Erst die Paketlisten kopieren, dann installieren');
  assert.ok(index(/^RUN npm ci/i) < index(/^COPY src/i), 'Erst installieren, dann den Code kopieren (Schicht-Cache)');
  assert.ok(index(/^USER node/i) > index(/^RUN npm ci/i), 'USER node erst nach der Installation');
});
