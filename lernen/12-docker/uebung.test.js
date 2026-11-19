const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require(process.env.LOESUNG ? './loesung.js' : './uebung.js');

test('1. parseImage', () => {
  assert.deepEqual(m.parseImage('nodered/node-red:5.0.10'), { repository: 'nodered/node-red', tag: '5.0.10' });
  assert.deepEqual(m.parseImage('mariadb:11.8'), { repository: 'mariadb', tag: '11.8' });
  assert.deepEqual(m.parseImage('mariadb'), { repository: 'mariadb', tag: 'latest' });
  assert.deepEqual(m.parseImage('localhost:5000/meinbild'), { repository: 'localhost:5000/meinbild', tag: 'latest' },
    'Der : vor dem / gehört zum Port der Registry, nicht zum Tag');
});

test('2. isPinned', () => {
  assert.equal(m.isPinned('grafana/grafana:13.3.1'), true);
  assert.equal(m.isPinned('grafana/grafana'), false);
  assert.equal(m.isPinned('grafana/grafana:latest'), false);
});

test('3. parsePort', () => {
  assert.deepEqual(m.parsePort('127.0.0.1:3306:3306'), { hostIp: '127.0.0.1', hostPort: 3306, containerPort: 3306 });
  assert.deepEqual(m.parsePort('8080:80'), { hostIp: '0.0.0.0', hostPort: 8080, containerPort: 80 });
  assert.deepEqual(m.parsePort('3000'), { hostIp: '0.0.0.0', hostPort: 3000, containerPort: 3000 });
});

test('4. onlyLocal', () => {
  assert.equal(m.onlyLocal('127.0.0.1:1880:1880'), true);
  assert.equal(m.onlyLocal('1880:1880'), false, 'Ohne IP ist der Port im ganzen Netz offen');
});

test('5. expandVars', () => {
  assert.equal(m.expandVars('127.0.0.1:${DB_PORT:-3306}:3306', {}), '127.0.0.1:3306:3306');
  assert.equal(m.expandVars('127.0.0.1:${DB_PORT:-3306}:3306', { DB_PORT: '3307' }), '127.0.0.1:3307:3306');
  assert.equal(m.expandVars('${A}-${B:-x}', { A: '1' }), '1-x');
  assert.equal(m.expandVars('${X}', {}), '');
});

test('6. dbAddress', () => {
  assert.equal(m.dbAddress('pc'), '127.0.0.1:3306');
  assert.equal(m.dbAddress('container'), 'mariadb:3306', 'Im Container ist 127.0.0.1 der Container selbst');
});

test('7. Die echte compose.yaml: feste Versionen, nur lokal erreichbar', () => {
  const compose = fs.readFileSync(path.join(__dirname, '..', '..', 'compose.yaml'), 'utf8');
  const images = [...compose.matchAll(/^\s+image:\s*(\S+)/gm)].map((x) => x[1]);
  const ports = [...compose.matchAll(/^\s+-\s*"([^"]+:\d+)"\s*$/gm)].map((x) => m.expandVars(x[1], {}));
  assert.equal(images.length, 3);
  for (const img of images) assert.ok(m.isPinned(img), `${img} hat keine feste Version`);
  assert.equal(ports.length, 3);
  for (const p of ports) assert.ok(m.onlyLocal(p), `${p} ist nicht nur lokal erreichbar`);
});

test('8. Dockerfile', () => {
  const file = process.env.LOESUNG ? 'loesung.Dockerfile' : 'Dockerfile';
  const lines = fs.readFileSync(path.join(__dirname, file), 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
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
