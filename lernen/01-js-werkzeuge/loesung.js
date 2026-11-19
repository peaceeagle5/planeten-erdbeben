// Einheit 01 – Musterlösung

function formatFood(food) {
  return `${food.name}: ${food.calories} kcal`;
}

function describeProtein({ name, protein }) {
  return `${name} hat ${protein} g Eiweiß`;
}

function toPlace(coordinates) {
  const [lon, lat, depth] = coordinates;
  return { lat, lon, depthKm: depth }; // { lat } ist kurz für { lat: lat }
}

function depthOrDefault(depth) {
  return depth ?? 10;
}

function placeOf(feature) {
  return feature?.properties?.place ?? 'unbekannt';
}

function addFood(list, food) {
  return [...list, food];
}

function withCalories(food, calories) {
  return { ...food, calories };
}

function strengthLabels(magnitudes) {
  return magnitudes.map((m) => (m < 6 ? 'mittel' : m < 7 ? 'stark' : 'sehr stark'));
}

module.exports = { formatFood, describeProtein, toPlace, depthOrDefault, placeOf, addFood, withCalories, strengthLabels };
