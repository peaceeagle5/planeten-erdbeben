// Einheit 02 – Musterlösung
const Astronomy = require('astronomy-engine');

function calculateCalories(caloriesPer100g, weightInGrams) {
  return (caloriesPer100g / 100) * weightInGrams;
}

function mealCalories(items) {
  return items.reduce((total, item) => total + calculateCalories(item.per100g, item.grams), 0);
}

function moonPhaseDeg(date) {
  return Math.round(Astronomy.MoonPhase(date));
}

function moonPhaseName(deg) {
  if (deg < 45 || deg >= 315) return 'Neumond';
  if (deg < 135) return 'zunehmend';
  if (deg < 225) return 'Vollmond';
  return 'abnehmend';
}

const HELPER = 'privat'; // eslint-disable-line no-unused-vars
module.exports = { calculateCalories, mealCalories, moonPhaseDeg, moonPhaseName };
