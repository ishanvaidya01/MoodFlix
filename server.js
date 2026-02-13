const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

/* ---------------- KEYWORD DETECTION ---------------- */

const moodGenres = {
  happy: [35, 10751],
  sad: [18],
  romantic: [10749],
  horror: [27],
  action: [28],
  thriller: [53],
  adventure: [12],
  comedy: [35],
  crime: [80],
  mystery: [9648],
  fantasy: [14],
  sci: [878]
};

const languageKeywords = {
  hindi: "hi",
  tamil: "ta",
  telugu: "te",
  kannada: "kn",
  english: "en"
};

function detectGenres(query) {
  const lower = query.toLowerCase();
  let genres = [];

  Object.keys(moodGenres).forEach(key => {
    if (lower.includes(key)) {
      genres = genres.concat(moodGenres[key]);
    }
  });

  return [...new Set(genres)];
}

function detectLanguage(query) {
  const lower = query.toLowerCase();
  for (let key in languageKeywords) {
    if (lower.includes(key)) {
      return languageKeywords[key];
    }
  }
  return "";
}

/* ---------------- ROUTES ---------------- */

app.get("/", (req, res) => {
  res.send("MoodFlix AI 3.0 Running");
});

/* SMART RECOMMENDATION */

app.post("/recommend", async (req, res) => {
  const { query = "", language = "" } = req.body;

  try {
    let detectedLanguage = language || detectLanguage(query);
    let genres = detectGenres(query);

    // 1️⃣ If free-text search
    if (query.trim()) {
      const searchRes = await axios.get(`${TMDB}/search/movie`, {
        params: {
          api_key: API_KEY,
          query,
          include_adult: false
        }
      });

      let results = searchRes.data.results.filter(movie =>
        detectedLanguage ? movie.original_language === detectedLanguage : true
      );

      if (results.length > 5) {
        return res.json({ results });
      }
    }

    // 2️⃣ Genre-based discovery
    const discoverRes = await axios.get(`${TMDB}/discover/movie`, {
      params: {
        api_key: API_KEY,
        with_genres: genres.length ? genres.join(",") : undefined,
        with_original_language: detectedLanguage || undefined,
        sort_by: "popularity.desc",
        vote_count_gte: 200,
        page: Math.floor(Math.random() * 10) + 1
      }
    });

    res.json({ results: discoverRes.data.results });

  } catch {
    res.status(500).json({ error: "Recommendation failed" });
  }
});

/* TRENDING */

app.get("/trending", async (req, res) => {
  const response = await axios.get(`${TMDB}/trending/movie/week`, {
    params: { api_key: API_KEY }
  });
  res.json({ results: response.data.results });
});

/* TOP RATED */

app.get("/top-rated", async (req, res) => {
  const response = await axios.get(`${TMDB}/movie/top_rated`, {
    params: { api_key: API_KEY }
  });
  res.json({ results: response.data.results });
});

app.listen(process.env.PORT || 5000);