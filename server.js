const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

if (!API_KEY) {
  console.error("❌ TMDB_KEY missing in .env");
  process.exit(1);
}

/* =====================================
   HEALTH CHECK
===================================== */
app.get("/", (req, res) => {
  res.json({ status: "MoodFlix Backend Running 🚀" });
});

/* =====================================
   LOAD GENRES SAFELY
===================================== */

let genreMap = {};
let genresLoaded = false;

async function loadGenres() {
  try {
    const res = await axios.get(`${TMDB}/genre/movie/list`, {
      params: { api_key: API_KEY }
    });

    res.data.genres.forEach(g => {
      genreMap[g.name.toLowerCase()] = g.id;
    });

    genresLoaded = true;
    console.log("✅ Genres loaded");
  } catch (err) {
    console.error("❌ Failed to load genres", err.message);
  }
}

loadGenres();

/* =====================================
   MOOD MAP
===================================== */

const moodMap = {
  sad: ["drama"],
  happy: ["comedy", "family"],
  romantic: ["romance"],
  romance: ["romance"],
  love: ["romance"],
  excited: ["action", "adventure"],
  nostalgic: ["family", "drama"],
  scared: ["horror", "thriller"],
  thriller: ["thriller"],
  horror: ["horror"],
  action: ["action"],
  motivated: ["drama"],
  bored: ["mystery"]
};

/* =====================================
   BULK FETCH
===================================== */

async function fetchDiscover(genres, language) {
  let results = [];

  for (let i = 1; i <= 5; i++) {
    const res = await axios.get(`${TMDB}/discover/movie`, {
      params: {
        api_key: API_KEY,
        with_genres: genres.join(","),
        with_original_language: language,
        sort_by: "vote_average.desc",
        "vote_count.gte": 150,
        page: i
      }
    });

    results.push(...res.data.results);
  }

  return results.filter(m => m.poster_path);
}

/* =====================================
   FALLBACK SEARCH
===================================== */

async function fallbackSearch(query) {
  const res = await axios.get(`${TMDB}/search/movie`, {
    params: {
      api_key: API_KEY,
      query,
      include_adult: false
    }
  });

  return res.data.results.filter(m => m.poster_path);
}

/* =====================================
   SEARCH ENDPOINT
===================================== */

app.post("/search", async (req, res) => {
  try {
    const { query = "" } = req.body;
    const lower = query.toLowerCase().trim();

    if (!lower) {
      return res.json({
        english: [],
        hindi: [],
        tamil: [],
        telugu: [],
        marathi: []
      });
    }

    if (!genresLoaded) {
      await loadGenres();
    }

    let genres = [];

    // 1️⃣ Mood mapping
    if (moodMap[lower]) {
      moodMap[lower].forEach(g => {
        if (genreMap[g]) genres.push(genreMap[g]);
      });
    }

    // 2️⃣ Direct genre match
    if (genreMap[lower]) {
      genres.push(genreMap[lower]);
    }

    // 3️⃣ If genre found → Discover API
    if (genres.length > 0) {
      const english = await fetchDiscover(genres, "en");
      const hindi = await fetchDiscover(genres, "hi");
      const tamil = await fetchDiscover(genres, "ta");
      const telugu = await fetchDiscover(genres, "te");
      const marathi = await fetchDiscover(genres, "mr");

      return res.json({ english, hindi, tamil, telugu, marathi });
    }

    // 4️⃣ Fallback to TMDB search
    const searched = await fallbackSearch(lower);

    return res.json({
      english: searched.filter(m => m.original_language === "en"),
      hindi: searched.filter(m => m.original_language === "hi"),
      tamil: searched.filter(m => m.original_language === "ta"),
      telugu: searched.filter(m => m.original_language === "te"),
      marathi: searched.filter(m => m.original_language === "mr")
    });

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

/* =====================================
   MOVIE DETAILS
===================================== */

app.get("/movie/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${TMDB}/movie/${req.params.id}`,
      {
        params: {
          api_key: API_KEY,
          append_to_response: "videos"
        }
      }
    );

    const trailer = response.data.videos.results.find(
      v => v.type === "Trailer" && v.site === "YouTube"
    );

    res.json({
      ...response.data,
      trailerKey: trailer ? trailer.key : null
    });

  } catch (err) {
    console.error("Details error:", err.message);
    res.status(500).json({ error: "Details failed" });
  }
});

/* =====================================
   START SERVER
===================================== */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});