/**
 * lib/mood.js — pure mood-matching engine (no I/O, fully unit-testable).
 *
 * Maps free-form emotional input ("i feel heartbroken", "mind bending please",
 * "cozy monsoon evening") onto MovieLens genre names with weights, using:
 *  - multi-word phrase matching before single-token matching
 *  - synonym groups (one signal, many phrasings)
 *  - negation handling ("not scary" suppresses fear genres)
 */

/** MovieLens genre vocabulary (strings, exactly as stored in movies.csv). */
const GENRES = [
  "Action", "Adventure", "Animation", "Children", "Comedy", "Crime",
  "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror", "IMAX",
  "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western",
];

/** Each entry: phrases that signal the mood, and MovieLens genres it maps to. */
const MOOD_GROUPS = [
  {
    id: "feel-good",
    phrases: ["feel good", "feel-good", "uplifting", "cozy", "comfort", "cheerful", "delightful", "monsoon"],
    genres: ["Comedy", "Family", "Romance"],
  },
  {
    id: "happy",
    phrases: ["happy", "joyful", "overjoyed", "gleeful"],
    genres: ["Comedy", "Children"],
  },
  {
    id: "sad",
    phrases: ["sad", "depressed", "low", "blue", "gloomy", "melancholy"],
    genres: ["Drama"],
  },
  {
    id: "heartbroken",
    phrases: ["heartbroken", "heart broken", "broken heart", "dumped", "breakup", "long distance"],
    genres: ["Drama", "Romance"],
  },
  {
    id: "lonely",
    phrases: ["lonely", "alone", "isolated"],
    genres: ["Drama", "Romance", "Mystery"],
  },
  {
    id: "romantic",
    phrases: ["romantic", "romance", "love", "in love", "date night", "anniversary"],
    genres: ["Romance", "Comedy"],
  },
  {
    id: "excited",
    phrases: ["excited", "hyped", "pumped", "energetic", "adrenaline"],
    genres: ["Action", "Adventure", "Thriller"],
  },
  {
    id: "adventurous",
    phrases: ["adventurous", "adventure", "explorer", "expedition", "treasure", "journey", "travel"],
    genres: ["Adventure", "Action"],
  },
  {
    id: "angry",
    phrases: ["angry", "furious", "mad", "rage", "pissed", "revenge"],
    genres: ["Action", "Thriller", "Crime"],
  },
  {
    id: "thrilled",
    phrases: ["thrilled", "thriller", "edge of my seat", "suspense", "suspenseful"],
    genres: ["Thriller", "Mystery"],
  },
  {
    id: "scared",
    phrases: ["scared", "horror", "terrified", "creepy", "spooky", "nightmare", "haunted"],
    genres: ["Horror", "Thriller"],
  },
  {
    id: "nostalgic",
    phrases: ["nostalgic", "nostalgia", "old memories", "childhood", "throwback", "memories"],
    genres: ["Family", "Drama", "Comedy"],
  },
  {
    id: "overwhelmed",
    phrases: ["overwhelmed", "stressed", "burnout", "burnt out"],
    genres: ["Drama"],
  },
  {
    id: "motivated",
    phrases: ["motivated", "inspired", "motivation", "focus", "hustle", "grind", "success", "biopic"],
    genres: ["Drama", "War"],
  },
  {
    id: "bored",
    phrases: ["bored", "boring day", "nothing to do"],
    genres: ["Mystery", "Sci-Fi", "Comedy"],
  },
  {
    id: "curious",
    phrases: ["curious", "mind bending", "mindbending", "twist", "twists", "puzzle", "riddle"],
    genres: ["Mystery", "Sci-Fi", "Thriller"],
  },
  {
    id: "sci-fi",
    phrases: ["sci-fi", "sci fi", "science fiction", "space", "future", "time travel", "alien"],
    genres: ["Sci-Fi", "Adventure"],
  },
  {
    id: "funny",
    phrases: ["funny", "laugh", "laughter", "comedy", "hilarious"],
    genres: ["Comedy"],
  },
  {
    id: "family-night",
    phrases: ["family night", "with family", "for kids", "kid friendly", "together", "with the kids"],
    genres: ["Family", "Children", "Animation"],
  },
  {
    id: "documentary",
    phrases: ["documentary", "real story", "true story", "learn something"],
    genres: ["Documentary"],
  },
  {
    id: "musical",
    phrases: ["musical", "songs", "dance", "music"],
    genres: ["Musical", "Romance"],
  },
  {
    id: "westerly",
    phrases: ["western", "cowboy", "wild west"],
    genres: ["Western"],
  },
];

/** Single words that invert the following mood signal (light negation support). */
const NEGATORS = new Set(["not", "no", "never", "dont", "don't", "cant", "can't"]);

/** Genre name -> canonical MovieLens form. */
function canonicalGenre(name) {
  if (!name) return null;
  const canon = name.toLowerCase();
  return GENRES.find((g) => g.toLowerCase() === canon) || null;
}

/**
 * Detect moods + genre weights from free-form text.
 * @param {string} input raw user text
 * @returns {{ moods: string[], genreWeights: Object.<string, number>, matchedPhrases: string[] }}
 */
function analyzeMood(input) {
  const text = String(input || "").toLowerCase().trim();
  const moods = [];
  const matchedPhrases = [];
  const genreWeights = Object.create(null);

  if (text.length === 0) return { moods, genreWeights, matchedPhrases };

  const words = text.replace(/[^a-z'\s-]/g, " ").split(/\s+/).filter(Boolean);

  for (const group of MOOD_GROUPS) {
    for (const phrase of group.phrases) {
      const multiWord = phrase.includes(" ");
      const idx = multiWord
        ? text.indexOf(phrase)
        : words.some((w) => w === phrase) || (phrase.length > 3 && text.includes(phrase))
          ? text.indexOf(phrase)
          : -1;
      if (idx === -1) continue;

      /* negation: look back a couple of words */
      const before = text.slice(Math.max(0, idx - 12), idx).split(/\s+/).filter(Boolean).slice(-2);
      if (before.some((w) => NEGATORS.has(w))) continue;

      moods.push(group.id);
      group.genres.forEach((g, i) => {
        genreWeights[g] = (genreWeights[g] || 0) + (group.genres.length - i);
      });
      matchedPhrases.push(phrase);
      break; /* one phrase per group */
    }
  }

  /* normalize weights to 0..1 */
  const max = Math.max(1, ...Object.values(genreWeights));
  for (const g of Object.keys(genreWeights)) genreWeights[g] = genreWeights[g] / max;

  return { moods, genreWeights, matchedPhrases };
}

module.exports = { analyzeMood, MOOD_GROUPS, GENRES, canonicalGenre };
