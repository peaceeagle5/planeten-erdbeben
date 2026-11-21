// Builds the setup wizard as single-file programs (Node.js "single executable applications").
//
//   node setup-wizard/build.js              -> dist/ for Windows x64, Linux x64, Linux arm64
//   node setup-wizard/build.js darwin-arm64 -> only the given target(s)
//
// The official Node.js binary for each platform is downloaded once into setup-wizard/.cache.
const { runBuild } = require('../shared/sea-build');
const { ASSET_FILES } = require('../shared/assets');

runBuild({ name: 'planeten-erdbeben-setup', entry: 'setup-wizard/server.js', assets: ASSET_FILES });
