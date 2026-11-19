// Einheit 04 – Musterlösung

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countStrongQuakes(fetchFn, minMag) {
  const res = await fetchFn(FEED);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.features.filter((f) => f.properties.mag >= minMag).length;
}

async function safeCount(fetchFn, minMag) {
  try {
    return { ok: true, count: await countStrongQuakes(fetchFn, minMag) };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function runAllChecks(checks) {
  return Promise.all(checks.map((check) => check()));
}

async function runInOrder(steps) {
  let result;
  for (const step of steps) {
    result = await step(result);
  }
  return result;
}

module.exports = { FEED, wait, countStrongQuakes, safeCount, runAllChecks, runInOrder };
