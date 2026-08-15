/**
 * Nutrition estimator
 * ───────────────────
 * There's no external nutrition API wired in, so this heuristically estimates
 * calories/protein/carbs/fat per serving by matching ingredient names against
 * a small per-100g reference table and scaling by parsed quantity/unit. It's
 * an approximation intended for a helpful "Estimated Nutrition" badge, not
 * medical/dietary advice.
 */

// Rough macro reference per 100g (or per typical unit noted) - illustrative, not clinical data
const REFERENCE = {
  chicken: { cal: 165, protein: 31, carbs: 0, fat: 3.6 },
  pork: { cal: 242, protein: 27, carbs: 0, fat: 14 },
  beef: { cal: 250, protein: 26, carbs: 0, fat: 17 },
  egg: { cal: 78, protein: 6, carbs: 0.6, fat: 5, perUnit: true }, // per whole egg
  rice: { cal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  noodle: { cal: 138, protein: 4.5, carbs: 25, fat: 2.1 },
  pasta: { cal: 131, protein: 5, carbs: 25, fat: 1.1 },
  flour: { cal: 364, protein: 10, carbs: 76, fat: 1 },
  cheese: { cal: 402, protein: 25, carbs: 1.3, fat: 33 },
  mozzarella: { cal: 280, protein: 22, carbs: 2.2, fat: 17 },
  cream: { cal: 340, protein: 2.1, carbs: 2.8, fat: 36 },
  butter: { cal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  oil: { cal: 884, protein: 0, carbs: 0, fat: 100 },
  potato: { cal: 77, protein: 2, carbs: 17, fat: 0.1 },
  tomato: { cal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  onion: { cal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  garlic: { cal: 149, protein: 6.4, carbs: 33, fat: 0.5 },
  pineapple: { cal: 50, protein: 0.5, carbs: 13, fat: 0.1 },
  cabbage: { cal: 25, protein: 1.3, carbs: 6, fat: 0.1 },
  yogurt: { cal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  lentil: { cal: 116, protein: 9, carbs: 20, fat: 0.4 },
  bean: { cal: 127, protein: 8.7, carbs: 23, fat: 0.5 },
  sugar: { cal: 387, protein: 0, carbs: 100, fat: 0 },
  sesame: { cal: 573, protein: 18, carbs: 12, fat: 50 },
  soy: { cal: 60, protein: 8.5, carbs: 5, fat: 2.5 }, // soy sauce
  tofu: { cal: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  shrimp: { cal: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  fish: { cal: 206, protein: 22, carbs: 0, fat: 12 },
  avocado: { cal: 160, protein: 2, carbs: 8.5, fat: 15 },
  coconut: { cal: 354, protein: 3.3, carbs: 15, fat: 33 },
  chocolate: { cal: 546, protein: 4.9, carbs: 61, fat: 31 },
};

// Approximate grams for common units, used when a recipe line has no explicit gram amount
const UNIT_TO_GRAMS = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  'fl_oz': 30,
  oz: 28,
  lb: 454,
  pinch: 0.5,
  whole: 100,
  '': 100, // unknown unit -> assume ~100g portion
};

function findReference(name) {
  const lower = name.toLowerCase();
  const key = Object.keys(REFERENCE).find((k) => lower.includes(k));
  return key ? REFERENCE[key] : null;
}

/**
 * ingredients: [{ name, quantity, unit }]
 * servings: number
 */
function estimateNutrition(ingredients = [], servings = 1) {
  let totals = { cal: 0, protein: 0, carbs: 0, fat: 0 };

  ingredients.forEach((ing) => {
    const ref = findReference(ing.name || '');
    if (!ref) return;

    let grams;
    if (ref.perUnit) {
      grams = (ing.quantity || 1) * 60; // approximate a "whole" unit as ~60g equivalent
    } else {
      const unitGrams = UNIT_TO_GRAMS[ing.unit] ?? 100;
      grams = (ing.quantity || 1) * unitGrams;
    }

    const factor = grams / 100;
    totals.cal += ref.cal * factor;
    totals.protein += ref.protein * factor;
    totals.carbs += ref.carbs * factor;
    totals.fat += ref.fat * factor;
  });

  const perServing = Math.max(servings, 1);
  return {
    calories: Math.round(totals.cal / perServing),
    protein: Math.round(totals.protein / perServing),
    carbs: Math.round(totals.carbs / perServing),
    fat: Math.round(totals.fat / perServing),
    estimatedPerServing: true,
  };
}

module.exports = { estimateNutrition };
