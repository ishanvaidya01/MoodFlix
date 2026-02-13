const express = require("express");
const axios = require("axios");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./favorites.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY,
      title TEXT,
      poster TEXT,
      rating REAL,
      language TEXT,
      type TEXT
    )
  `);
});

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

/* -------------------- MOOD → GENRE MAP -------------------- */

const moodGenres = {
  happy: [35, 10751, 12],           // Comedy, Family, Adventure
  sad: [18, 10749],                 // Drama, Romance
  romantic: [10749, 18],
  horror: [27],
  action: [28, 53],                 // Action + Thriller
  thriller: [53, 9648],             // Thriller + Mystery
  adventure: [12, 14]               // Adventure + Fantasy
};

/* -------------------- HEALTH -------------------- */

app.get("/", (req, res) => {
  res.send("MoodFlix 2.0 Backend Running");
});

/* -------------------- RECOMMEND -------------------- */

app.post("/recommend", async (req, res) => {
  const {
    mood,
    language = "",
    type = "movie"
  } = req.body;

  if (!mood) {
    return res.status(400).json({ error: "Mood required" });
  }

  const genres = moodGenres[mood.toLowerCase()] || [18];

  const randomPage = Math.floor(Math.random() * 20) + 1;
  const sortOptions = [
    "popularity.desc",
    "vote_average.desc",
    "vote_count.desc",
    "release_date.desc"
  ];

  const randomSort =
    sortOptions[Math.floor(Math.random() * sortOptions.length)];

  try {
    const response = await axios.get(
      `${TMDB}/discover/${type}`,
      {
        params: {
          api_key: API_KEY,
          with_genres: genres.join(","),
          with_original_language: language || undefined,
          sort_by: randomSort,
          page: randomPage,
          "vote_count.gte": 100
        }
      }
    );

    res.json({
      results: response.data.results
    });

  } catch (err) {
    res.status(500).json({ error: "Recommendation failed" });
  }
});

/* -------------------- DETAILS + OTT -------------------- */

app.get("/details/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  try {
    const details = await axios.get(
      `${TMDB}/${type}/${id}`,
      {
        params: {
          api_key: API_KEY,
          append_to_response: "videos"
        }
      }
    );

    const providers = await axios.get(
      `${TMDB}/${type}/${id}/watch/providers`,
      {
        params: { api_key: API_KEY }
      }
    );

    const indiaProviders =
      providers.data.results?.IN?.flatrate || [];

    res.json({
      ...details.data,
      watchProviders: indiaProviders
    });

  } catch {
    res.status(500).json({ error: "Details fetch failed" });
  }
});

/* -------------------- FAVORITES -------------------- */

app.post("/favorite", (req, res) => {
  const { id, title, poster, rating, language, type } = req.body;

  db.run(
    `INSERT OR IGNORE INTO favorites 
     (id, title, poster, rating, language, type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, title, poster, rating, language, type]
  );

  res.json({ success: true });
});

app.get("/favorites", (req, res) => {
  db.all("SELECT * FROM favorites", [], (err, rows) => {
    res.json(rows);
  });
});

app.delete("/favorite/:id", (req, res) => {
  db.run("DELETE FROM favorites WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

/* -------------------- SERVER -------------------- */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`MoodFlix backend running on ${PORT}`);
});