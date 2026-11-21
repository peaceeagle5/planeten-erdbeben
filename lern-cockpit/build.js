// Builds the Lern-Cockpit as single-file programs (Node.js "single executable applications").
//
//   npm run build-cockpit                     -> dist/ for Windows x64, Linux x64, Linux arm64
//   node lern-cockpit/build.js darwin-arm64   -> only the given target(s)
//
// The program looks for the project folder (the one with lernen/) next to itself and above,
// then in the folder it was started from. Node.js must be installed for the tests in the terminal.
const { runBuild } = require('../shared/sea-build');
const { ASSET_FILES } = require('./assets');

runBuild({ name: 'planeten-lern-cockpit', entry: 'lern-cockpit/server.js', assets: ASSET_FILES });
