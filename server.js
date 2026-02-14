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

/* =====================================================
   BASIC MEMORY CACHE (FAST + FREE PERFORMANCE BOOST)
===================================================== */

const cache = {};
const CACHE_TIME = 1000 * 60 * 30; // 30 minutes

function getCache(key) {
  if (!cache[key]) return null;
  if (Date.now() - cache[key].time > CACHE_TIME) {
    delete cache[key];
    return null;
  }
  return cache[key].data;
}

function setCache(key, data) {
  cache[key] = { data, time: Date.now() };
}

/* =====================================================
   LOAD GENRES
===================================================== */

let genreMap = {};
let genresLoaded = false;

async function loadGenres() {
  const cached = getCache("genres");
  if (cached) {
    genreMap = cached;
    genresLoaded = true;
    return;
  }

  const res = await axios.get(`${TMDB}/genre/movie/list`, {
    params: { api_key: API_KEY }
  });

  res.data.genres.forEach(g => {
    genreMap[g.name.toLowerCase()] = g.id;
  });

  setCache("genres", genreMap);
  genresLoaded = true;
}

loadGenres();

/* =====================================================
   MASSIVE MOOD MAP
===================================================== */

const moodMap = {
  sad: ["drama"],
  depressed: ["drama"],
  heartbroken: ["romance", "drama"],
  lonely: ["romance"],
  happy: ["comedy", "family"],
  overjoyed: ["comedy"],
  joyful: ["comedy"],
  excited: ["action", "adventure"],
  angry: ["action", "thriller"],
  romantic: ["romance"],
  love: ["romance"],
  nostalgic: ["family", "drama"],
  overwhelmed: ["drama"],
  scared: ["horror", "thriller"],
  horror: ["horror"],
  thriller: ["thriller"],
  action: ["action"],
  motivated: ["drama"],
  bored: ["mystery"],
  adventurous: ["adventure", "action"],
  curious: ["mystery", "science fiction"]
};

function detectMood(input) {
  for (let mood in moodMap) {
    if (input.includes(mood)) {
      return moodMap[mood];
    }
  }
  return null;
}

/* =====================================================
   MASSIVE LANGUAGE FETCH
===================================================== */

async function fetchMassiveByLanguage(lang, genres) {
  const cacheKey = `${lang}-${genres.join(",")}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const pages = Array.from({ length: 20 }, (_, i) => i + 1);

  const requests = pages.map(page =>
    axios.get(`${TMDB}/discover/movie`, {
      params: {
        api_key: API_KEY,
        with_original_language: lang,
        with_genres: genres.length ? genres.join(",") : undefined,
        sort_by: "popularity.desc",
        page
      }
    })
  );

  const responses = await Promise.all(requests);

  let results = [];
  responses.forEach(r => {
    results.push(...r.data.results);
  });

  results = results.filter(m => m.poster_path);

  setCache(cacheKey, results);
  return results;
}

/* =====================================================
   TRENDING (BLEND BOOST)
===================================================== */

async function fetchTrending(lang) {
  const cacheKey = `trending-${lang}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const pages = [1, 2, 3];

  const requests = pages.map(page =>
    axios.get(`${TMDB}/trending/movie/week`, {
      params: {
        api_key: API_KEY,
        page
      }
    })
  );

  const responses = await Promise.all(requests);

  let results = [];
  responses.forEach(r => {
    results.push(...r.data.results);
  });

  results = results
    .filter(m => m.poster_path && m.original_language === lang);

  setCache(cacheKey, results);
  return results;
}

/* =====================================================
   SEARCH ENDPOINT (MAX POWER)
===================================================== */

app.post("/search", async (req, res) => {
  try {
    const { query = "" } = req.body;
    const lower = query.toLowerCase().trim();

    if (!genresLoaded) await loadGenres();

    let genres = [];
    const detected = detectMood(lower);

    if (detected) {
      detected.forEach(g => {
        if (genreMap[g]) genres.push(genreMap[g]);
      });
    }

    const languages = ["en", "hi", "ta", "te", "mr"];

    const results = await Promise.all(
      languages.map(lang =>
        fetchMassiveByLanguage(lang, genres)
      )
    );

    let response = {};

    for (let i = 0; i < languages.length; i++) {
      const lang = languages[i];
      let movies = results[i];

      // If low volume, blend trending
      if (movies.length < 150) {
        const trending = await fetchTrending(lang);
        movies = [...movies, ...trending];
      }

      response[
        lang === "en" ? "english" :
        lang === "hi" ? "hindi" :
        lang === "ta" ? "tamil" :
        lang === "te" ? "telugu" :
        "marathi"
      ] = movies.sort((a, b) => b.popularity - a.popularity);
    }

    res.json(response);

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

/* =====================================================
   MOVIE DETAILS
===================================================== */

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

/* =====================================================
   START SERVER
===================================================== */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});