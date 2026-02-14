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
   MASSIVE MOOD MAP
===================================== */

const moodMap = {
  sad: ["drama"],
  heartbroken: ["romance", "drama"],
  lonely: ["romance", "drama"],
  depressed: ["drama"],
  happy: ["comedy", "family"],
  overjoyed: ["comedy", "music"],
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

/* =====================================
   DETECT MOOD FROM SENTENCE
===================================== */

function detectMood(input) {
  for (let mood in moodMap) {
    if (input.includes(mood)) {
      return moodMap[mood];
    }
  }
  return null;
}

/* =====================================
   MASSIVE DISCOVER FETCH
===================================== */

async function fetchMassiveDiscover(genres) {
  const pages = Array.from({ length: 15 }, (_, i) => i + 1);

  const requests = pages.map(page =>
    axios.get(`${TMDB}/discover/movie`, {
      params: {
        api_key: API_KEY,
        with_genres: genres.length ? genres.join(",") : undefined,
        sort_by: "popularity.desc",
        page
      }
    })
  );

  const responses = await Promise.all(requests);

  let results = [];
  responses.forEach(res => {
    results.push(...res.data.results);
  });

  return results.filter(m => m.poster_path);
}

/* =====================================
   TRENDING
===================================== */

async function fetchTrending() {
  const pages = [1, 2, 3];

  const requests = pages.map(page =>
    axios.get(`${TMDB}/trending/movie/week`, {
      params: { api_key: API_KEY, page }
    })
  );

  const responses = await Promise.all(requests);

  let results = [];
  responses.forEach(res => {
    results.push(...res.data.results);
  });

  return results.filter(m => m.poster_path);
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

    let genres = [];

    const detected = detectMood(lower);

    if (detected) {
      detected.forEach(g => {
        if (genreMap[g]) genres.push(genreMap[g]);
      });
    }

    let massiveResults = await fetchMassiveDiscover(genres);

    if (massiveResults.length < 200) {
      const trending = await fetchTrending();
      massiveResults = [...massiveResults, ...trending];
    }

    const english = massiveResults
      .filter(m => m.original_language === "en")
      .sort((a, b) => b.vote_average - a.vote_average);

    const hindi = massiveResults
      .filter(m => m.original_language === "hi")
      .sort((a, b) => b.vote_average - a.vote_average);

    const tamil = massiveResults
      .filter(m => m.original_language === "ta")
      .sort((a, b) => b.vote_average - a.vote_average);

    const telugu = massiveResults
      .filter(m => m.original_language === "te")
      .sort((a, b) => b.vote_average - a.vote_average);

    const marathi = massiveResults
      .filter(m => m.original_language === "mr")
      .sort((a, b) => b.vote_average - a.vote_average);

    res.json({ english, hindi, tamil, telugu, marathi });

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
   START SERVER
===================================== */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});