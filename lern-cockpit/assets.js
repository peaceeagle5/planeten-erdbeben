// Files the Lern-Cockpit page needs. The server delivers them; inside the built program
// they are embedded as assets (build.js), during development they are read from disk.
/** URL path → [file relative to the project, content type] */
const UI_ASSETS = {
  '/': ['lern-cockpit/ui.html', 'text/html'],
  '/ui/app.mjs': ['lern-cockpit/ui/app.mjs', 'text/javascript'],
  '/ui/html.mjs': ['lern-cockpit/ui/html.mjs', 'text/javascript'],
  '/ui/highlight.mjs': ['lern-cockpit/ui/highlight.mjs', 'text/javascript'],
  '/ui/markdown.mjs': ['lern-cockpit/ui/markdown.mjs', 'text/javascript'],
  '/ui/terminal.mjs': ['lern-cockpit/ui/terminal.mjs', 'text/javascript'],
};
const REPORTER_ASSET = 'lern-cockpit/reporter.mjs';
const ASSET_FILES = [...Object.values(UI_ASSETS).map(([file]) => file), REPORTER_ASSET];

module.exports = { UI_ASSETS, REPORTER_ASSET, ASSET_FILES };
