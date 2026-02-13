const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

/* HEALTH */
app.get("/", (req, res) => {
  res.json({ status: "MoodFlix running" });
});

/* GENRES */
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

/* MOOD INTELLIGENCE */
const moodMap = {
  sad: ["drama"],
  happy: ["comedy", "family"],
  romantic: ["romance"],
  lonely: ["drama"],
  stressed: ["comedy"],
  excited: ["action", "adventure"],
  nostalgic: ["family", "drama"],
  scared: ["horror", "thriller"],
  motivated: ["drama"],
  bored: ["thriller", "mystery"]
};

/* FETCH BY LANGUAGE */
async function fetchByLanguage(genreIds, language) {
  let results = [];

  for (let i = 1; i <= 8; i++) {
    const res = await axios.get(`${TMDB}/discover/movie`, {
      params: {
        api_key: API_KEY,
        with_genres: genreIds.join(","),
        with_original_language: language,
        sort_by: "vote_average.desc",
        "vote_count.gte": 100,
        page: i
      }
    });

    results.push(...res.data.results);
  }

  return results.filter(m => m.poster_path);
}

/* SEARCH */
app.post("/search", async (req, res) => {
  const { query = "" } = req.body;
  const lower = query.toLowerCase();

  let genres = [];

  if (moodMap[lower]) {
    moodMap[lower].forEach(g => {
      if (genreMap[g]) genres.push(genreMap[g]);
    });
  }

  if (genres.length === 0) {
    return res.json({
      hero: [],
      english: [],
      hindi: [],
      tamil: [],
      telugu: [],
      marathi: []
    });
  }

  try {
    const english = await fetchByLanguage(genres, "en");
    const hindi = await fetchByLanguage(genres, "hi");
    const tamil = await fetchByLanguage(genres, "ta");
    const telugu = await fetchByLanguage(genres, "te");
    const marathi = await fetchByLanguage(genres, "mr");

    res.json({
      hero: english.slice(0, 5),
      english,
      hindi,
      tamil,
      telugu,
      marathi
    });

  } catch (err) {
    res.status(500).json({ error: "Mood search failed" });
  }
});

/* DETAILS */
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

  } catch {
    res.status(500).json({ error: "Details failed" });
  }
});

app.listen(process.env.PORT || 5000);