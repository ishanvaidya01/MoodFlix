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
   LOAD GENRES
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
   EXPANDED MOOD MAP
===================================== */

const moodMap = {
  sad: ["drama"],
  heartbroken: ["romance", "drama"],
  lonely: ["romance", "drama"],
  happy: ["comedy", "family"],
  overjoyed: ["comedy", "music"],
  excited: ["action", "adventure"],
  angry: ["action", "thriller"],
  romantic: ["romance"],
  love: ["romance"],
  nostalgic: ["family", "drama"],
  overwhelmed: ["drama", "family"],
  scared: ["horror", "thriller"],
  horror: ["horror"],
  thriller: ["thriller"],
  action: ["action"],
  motivated: ["drama"],
  bored: ["mystery"],
  adventurous: ["adventure", "action"],
  curious: ["mystery", "sci-fi"]
};

/* =====================================
   DISCOVER (PARALLEL)
===================================== */

async function fetchDiscover(genres, language) {
  const pages = [1, 2, 3, 4, 5];

  const requests = pages.map(page =>
    axios.get(`${TMDB}/discover/movie`, {
      params: {
        api_key: API_KEY,
        with_genres: genres.join(","),
        with_original_language: language,
        sort_by: "vote_average.desc",
        "vote_count.gte": 50,
        page
      }
    })
  );

  const responses = await Promise.all(requests);

  let results = [];
  responses.forEach(res => {
    results.push(...res.data.results);
  });

  return results
    .filter(m => m.poster_path)
    .sort((a, b) => b.vote_average - a.vote_average);
}

/* =====================================
   TRENDING (SAFE FALLBACK)
===================================== */

async function fetchTrending(language) {
  const res = await axios.get(`${TMDB}/trending/movie/week`, {
    params: { api_key: API_KEY }
  });

  return res.data.results
    .filter(m => m.poster_path && m.original_language === language)
    .sort((a, b) => b.vote_average - a.vote_average);
}

/* =====================================
   SEARCH FALLBACK
===================================== */

async function fallbackSearch(query) {
  const res = await axios.get(`${TMDB}/search/movie`, {
    params: {
      api_key: API_KEY,
      query,
      include_adult: false
    }
  });

  return res.data.results
    .filter(m => m.poster_path)
    .sort((a, b) => b.vote_average - a.vote_average);
}

/* =====================================
   SEARCH ENDPOINT
===================================== */

app.post("/search", async (req, res) => {
  try {
    const { query = "" } = req.body;
    const lower = query.toLowerCase().trim();

    if (!genresLoaded) {
      await loadGenres();
    }

    if (!lower) {
      const english = await fetchTrending("en");
      const hindi = await fetchTrending("hi");
      const tamil = await fetchTrending("ta");
      const telugu = await fetchTrending("te");
      const marathi = await fetchTrending("mr");

      return res.json({ english, hindi, tamil, telugu, marathi });
    }

    let genres = [];

    if (moodMap[lower]) {
      moodMap[lower].forEach(g => {
        if (genreMap[g]) genres.push(genreMap[g]);
      });
    }

    if (genreMap[lower]) {
      genres.push(genreMap[lower]);
    }

    if (genres.length > 0) {
      const english = await fetchDiscover(genres, "en");
      const hindi = await fetchDiscover(genres, "hi");
      const tamil = await fetchDiscover(genres, "ta");
      const telugu = await fetchDiscover(genres, "te");
      const marathi = await fetchDiscover(genres, "mr");

      return res.json({ english, hindi, tamil, telugu, marathi });
    }

    const searched = await fallbackSearch(lower);

    let english = searched.filter(m => m.original_language === "en");
    let hindi = searched.filter(m => m.original_language === "hi");
    let tamil = searched.filter(m => m.original_language === "ta");
    let telugu = searched.filter(m => m.original_language === "te");
    let marathi = searched.filter(m => m.original_language === "mr");

    if (
      !english.length &&
      !hindi.length &&
      !tamil.length &&
      !telugu.length &&
      !marathi.length
    ) {
      english = await fetchTrending("en");
      hindi = await fetchTrending("hi");
      tamil = await fetchTrending("ta");
      telugu = await fetchTrending("te");
      marathi = await fetchTrending("mr");
    }

    return res.json({ english, hindi, tamil, telugu, marathi });

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

/* =====================================
   MOVIE DETAILS (WITH PROVIDERS)
===================================== */

app.get("/movie/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${TMDB}/movie/${req.params.id}`,
      {
        params: {
          api_key: API_KEY,
          append_to_response: "videos,watch/providers"
        }
      }
    );

    const trailer = response.data.videos.results.find(
      v => v.type === "Trailer" && v.site === "YouTube"
    );

    const providers =
      response.data["watch/providers"]?.results?.IN?.flatrate || [];

    res.json({
      ...response.data,
      trailerKey: trailer ? trailer.key : null,
      providers
    });

  } catch (err) {
    console.error("Details error:", err.message);
    res.status(500).json({ error: "Details failed" });
  }
});

/* =====================================
   TRENDING ROUTE
===================================== */

app.get("/trending", async (req, res) => {
  try {
    const english = await fetchTrending("en");
    const hindi = await fetchTrending("hi");
    const tamil = await fetchTrending("ta");
    const telugu = await fetchTrending("te");
    const marathi = await fetchTrending("mr");

    res.json({ english, hindi, tamil, telugu, marathi });
  } catch (err) {
    res.status(500).json({ error: "Trending failed" });
  }
});

/* =====================================
   START SERVER
===================================== */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});