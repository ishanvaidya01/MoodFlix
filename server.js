const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

/* ===============================
   HEALTH ROUTE
================================= */
app.get("/", (req, res) => {
  res.json({ status: "MoodFlix backend running" });
});

/* ===============================
   CACHE SYSTEM
================================= */
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30;

function setCache(key, data) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/* ===============================
   GENRES
================================= */
let genreMap = {};

async function loadGenres() {
  const res = await axios.get(`${TMDB}/genre/movie/list`, {
    params: { api_key: API_KEY }
  });

  res.data.genres.forEach(g => {
    genreMap[g.name.toLowerCase()] = g.id;
  });
}

loadGenres();

/* ===============================
   BULK FETCH
================================= */
async function fetchBulk(url, params, pages = 5) {
  let results = [];

  for (let i = 1; i <= pages; i++) {
    const res = await axios.get(url, {
      params: { ...params, page: i }
    });

    results.push(...res.data.results);
  }

  return results;
}

/* ===============================
   RANKING
================================= */
function rankMovies(movies) {
  return movies
    .filter(m => m.poster_path)
    .sort((a, b) => {
      const scoreA =
        a.vote_average * Math.log(a.vote_count + 50);
      const scoreB =
        b.vote_average * Math.log(b.vote_count + 50);

      return scoreB - scoreA;
    });
}

/* ===============================
   SEARCH
================================= */
app.post("/search", async (req, res) => {
  const { query = "" } = req.body;
  const lower = query.toLowerCase();

  if (!lower.trim()) {
    return res.json({
      hero: [],
      english: [],
      hindi: [],
      tamil: [],
      telugu: [],
      marathi: []
    });
  }

  const cached = getCache(lower);
  if (cached) return res.json(cached);

  try {
    let movies = [];

    if (genreMap[lower]) {
      movies = await fetchBulk(
        `${TMDB}/discover/movie`,
        {
          api_key: API_KEY,
          with_genres: genreMap[lower],
          "vote_count.gte": 50
        },
        6
      );
    } else {
      movies = await fetchBulk(
        `${TMDB}/search/movie`,
        {
          api_key: API_KEY,
          query: lower,
          include_adult: false
        },
        4
      );
    }

    const ranked = rankMovies(movies);

    const response = {
      hero: ranked.slice(0, 5),
      english: ranked.filter(m => m.original_language === "en"),
      hindi: ranked.filter(m => m.original_language === "hi"),
      tamil: ranked.filter(m => m.original_language === "ta"),
      telugu: ranked.filter(m => m.original_language === "te"),
      marathi: ranked.filter(m => m.original_language === "mr")
    };

    setCache(lower, response);
    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

/* ===============================
   DETAILS
================================= */
app.get("/movie/:id", async (req, res) => {
  const cached = getCache(req.params.id);
  if (cached) return res.json(cached);

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

    const data = {
      ...response.data,
      trailerKey: trailer ? trailer.key : null
    };

    setCache(req.params.id, data);
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Details failed" });
  }
});

app.listen(process.env.PORT || 5000);