/**
 * Culture Encyclopedia
 * ────────────────────
 * Backend-served facts about each cuisine, powering the "Explore by Culture"
 * detail panels. Kept as a static module (not a DB collection) since it's
 * reference content that rarely changes; easy to move into Mongo later if
 * user-editable culture pages are ever needed.
 */

const CULTURE_FACTS = {
  Indian: {
    flag: '🇮🇳',
    region: 'South Asia',
    tagline: 'Bold spices & rich curries',
    history:
      'Indian cuisine spans thousands of years and dozens of regional traditions, shaped by Ayurvedic principles, Mughal court cooking, and coastal trade routes that brought chillies, potatoes and tomatoes from the Americas.',
    staples: ['Rice', 'Wheat (roti/naan)', 'Lentils (dal)', 'Ghee', 'Garam masala'],
    funFact: 'India uses more varieties of lentils in everyday cooking than almost any other cuisine on earth.',
    diningEtiquette: 'Traditionally eaten with the right hand; bread is used to scoop rather than cut.',
  },
  Italian: {
    flag: '🇮🇹',
    region: 'Southern Europe',
    tagline: 'Pasta, pizza & la dolce vita',
    history:
      'Italian cooking is fiercely regional - Naples gave the world pizza, Bologna its ragù, and Sicily blends Arab, Greek and Norman influences into dishes like arancini and caponata.',
    staples: ['Pasta', 'Olive oil', 'Tomatoes', 'Parmesan & Pecorino', 'Basil'],
    funFact: 'True Neapolitan pizza dough is regulated by law - only certain flours, yeast and cooking times qualify.',
    diningEtiquette: 'Meals unfold in courses: antipasto, primo, secondo, dolce - rarely all at once.',
  },
  Chinese: {
    flag: '🇨🇳',
    region: 'East Asia',
    tagline: 'Dim sum, stir-fries & more',
    history:
      "China's culinary map splits into at least eight major regional traditions (Sichuan, Cantonese, Hunan, and more), each shaped by climate, from fiery Sichuan pepper to delicate Cantonese steaming.",
    staples: ['Rice or noodles', 'Soy sauce', 'Ginger & garlic', 'Five-spice', 'Tea'],
    funFact: 'The wok\'s shape was engineered for maximum surface area over an open flame using minimal fuel.',
    diningEtiquette: 'Dishes are shared family-style from the center of the table, always with rice as the anchor.',
  },
  Mexican: {
    flag: '🇲🇽',
    region: 'North America',
    tagline: 'Tacos, salsas & fiesta flavors',
    history:
      'Rooted in Mesoamerican staples like corn, beans and chillies, Mexican cuisine absorbed Spanish, African and Middle Eastern influences (like al pastor\'s debt to shawarma) to become one of the few UNESCO-recognized Intangible Cultural Heritages.',
    staples: ['Corn (masa)', 'Beans', 'Chillies', 'Lime', 'Cilantro'],
    funFact: 'Mexico is home to over 60 native chile pepper varieties, each with a distinct flavor profile beyond heat.',
    diningEtiquette: 'Tacos are eaten by hand, folded, never with a fork - and street-style is the everyday norm.',
  },
  Japanese: {
    flag: '🇯🇵',
    region: 'East Asia',
    tagline: 'Sushi, ramen & umami perfection',
    history:
      'Japanese cooking prizes seasonality (shun) and minimal intervention, letting ingredients like dashi-based broths and impeccably sourced fish speak for themselves.',
    staples: ['Rice', 'Dashi (kombu & bonito broth)', 'Soy sauce', 'Miso', 'Nori'],
    funFact: 'Umami - the "fifth taste" - was first isolated and named by a Japanese chemist studying kombu broth in 1908.',
    diningEtiquette: 'Slurping noodles is polite (it cools them and shows enjoyment); pouring your own drink is not.',
  },
  French: {
    flag: '🇫🇷',
    region: 'Western Europe',
    tagline: 'Croissants, sauces & elegance',
    history:
      'Codified in the 17th-20th centuries by chefs like Carême and Escoffier, French cuisine established the five "mother sauces" and the brigade kitchen system still used in professional kitchens worldwide.',
    staples: ['Butter', 'Wine', 'Fresh herbs (herbes de Provence)', 'Cheese', 'Bread'],
    funFact: 'The French culinary meal itself is UNESCO-listed as an Intangible Cultural Heritage - the meal, not just a dish.',
    diningEtiquette: 'Bread is placed directly on the table (not the plate) and used to push food onto the fork.',
  },
  Thai: {
    flag: '🇹🇭',
    region: 'Southeast Asia',
    tagline: 'Sweet, sour, salty, spicy balance',
    history:
      'Thai food is built around balancing four core tastes in nearly every dish, blending Chinese stir-frying technique with Indian curry influence and native Southeast Asian herbs like lemongrass and galangal.',
    staples: ['Jasmine rice', 'Fish sauce', 'Lemongrass', 'Chillies', 'Coconut milk'],
    funFact: 'A traditional Thai meal is designed so every dish on the table balances the others in taste, not by course.',
    diningEtiquette: 'Eaten with a fork and spoon - the fork pushes food onto the spoon, never straight into the mouth.',
  },
  Korean: {
    flag: '🇰🇷',
    region: 'East Asia',
    tagline: 'Fermentation, banchan & bold heat',
    history:
      'Centuries of preserving vegetables through winter gave rise to kimchi and a wider fermentation culture (gochujang, doenjang) that still defines Korean cooking today.',
    staples: ['Rice', 'Gochujang (chile paste)', 'Kimchi', 'Sesame oil', 'Garlic'],
    funFact: 'There are documented regional kimchi varieties numbering in the hundreds, varying by vegetable and climate.',
    diningEtiquette: 'A full spread of banchan (side dishes) accompanies rice at nearly every meal, shared by the table.',
  },
};

module.exports = CULTURE_FACTS;
