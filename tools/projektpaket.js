// Project package: everything to run the project, including the setup executables and the
// Docker environment, but WITHOUT the learning units (those are in the learning package).
//
//   node tools/projektpaket.js   -> PlanetenErdbebenIoT.zip
//
// Build the executables first: npm run build-setup
const fs = require('node:fs');
const path = require('node:path');
const { buildPackage, SOURCES, GITIGNORE } = require('./paket');

const EXES = [
  'dist/planeten-erdbeben-setup-windows-x64.exe',
  'dist/planeten-erdbeben-setup-linux-x64',
  'dist/planeten-erdbeben-setup-linux-arm64',
];
for (const exe of EXES) {
  if (!fs.existsSync(path.join(__dirname, '..', exe))) throw new Error(`${exe} missing: run "npm run build-setup" first`);
}

buildPackage({
  name: 'PlanetenErdbebenIoT',
  out: 'PlanetenErdbebenIoT.zip',
  include: [...SOURCES, ...EXES],
  gitignore: GITIGNORE,
  jsonEdits: {
    'package.json': (p) => {
      // no learning units, so no Lern-Cockpit either
      for (const s of ['lernen', 'lernen:fisi', 'lernen:ui', 'build-cockpit']) delete p.scripts[s];
    },
  },
  edits: {
    'README.md': [
      [/\*\*Learning units \(German\):\*\*[^\n]*\n[^\n]*\n\n/, ''],
    ],
    // ERSTE-SCHRITTE.md is written for the learning package; without lernen/ these parts would point nowhere.
    'ERSTE-SCHRITTE.md': [
      ['1. Das Lernpaket (ZIP) entpacken', '1. Die ZIP-Datei entpacken'],
      [/## 3\. Ohne Server loslegen\n[\s\S]*?(?=\n## 4\.)/,
        '## 3. Setup-Programm oder npm\n\nStatt `npm run setup` (Schritt 5) kannst du auch das fertige Programm aus `dist/` starten:\n' +
        '`planeten-erdbeben-setup-windows-x64.exe` (Windows) oder `planeten-erdbeben-setup-linux-x64` (Linux).\n' +
        'Auf dem Mac gibt es kein fertiges Programm, dort `npm run setup`.\n'],
      ['| Datenbank, nur lesen (SQL-Übungen) |', '| Datenbank, nur lesen |'],
      [/\| SQL-Übungen werden übersprungen[^\n]*\n/, ''],
      [/\nMehr zur Fehlersuche: \[lernen[^\n]*\n?/, '\n'],
    ],
  },
});
