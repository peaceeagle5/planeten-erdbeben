// Learning package: project source + learning units + Lern-Cockpit + Docker environment, without executables.
//
//   node tools/lernpaket.js      -> dist/PlanetenErdbeben-Lernpaket.zip
const { buildPackage, SOURCES, GITIGNORE } = require('./paket');

buildPackage({
  name: 'PlanetenErdbeben-Lernpaket',
  out: 'dist/PlanetenErdbeben-Lernpaket.zip',
  include: [...SOURCES, 'lernen', 'lern-cockpit'],
  gitignore: GITIGNORE,
});
