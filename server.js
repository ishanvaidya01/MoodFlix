const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./favorites.db");

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY, title TEXT, poster TEXT, rating REAL, language TEXT)"
  );
});

const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/", (req, res) => {
  res.send("MoodFlix Backend Running");
});

// Recommend Movies
app.post("/recommend", async (req, res) => {
  const { mood, page = 1 } = req.body;

  if (!mood) {
    return res.status(400).json({ error: "Mood is required" });
  }

  const genreMap = {
    happy: 35,
    sad: 18,
    romantic: 10749,
    horror: 27,
    action: 28,
    thriller: 53,
    adventure: 12
  };

  const genreId = genreMap[mood.toLowerCase()] || 18;

  try {
    const movieResponse = await axios.get(
      "https://api.themoviedb.org/3/discover/movie",
      {
        params: {
          api_key: process.env.TMDB_KEY,
          with_genres: genreId,
          sort_by: "popularity.desc",
          page
        }
      }
    );

    res.json({
      movies: movieResponse.data.results,
      total_pages: movieResponse.data.total_pages
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Movie Details
app.get("/movie/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${req.params.id}`,
      {
        params: {
          api_key: process.env.TMDB_KEY,
          append_to_response: "videos"
        }
      }
    );
    res.json(response.data);
  } catch {
    res.status(500).json({ error: "Failed to fetch movie details" });
  }
});

// Add Favorite
app.post("/favorite", (req, res) => {
  const { id, title, poster, rating, language } = req.body;

  db.run(
    "INSERT OR IGNORE INTO favorites (id, title, poster, rating, language) VALUES (?, ?, ?, ?, ?)",
    [id, title, poster, rating, language]
  );

  res.json({ success: true });
});

// Remove Favorite
app.delete("/favorite/:id", (req, res) => {
  db.run("DELETE FROM favorites WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// Get Favorites
app.get("/favorites", (req, res) => {
  db.all("SELECT * FROM favorites", [], (err, rows) => {
    res.json(rows);
  });
});

// Serve React build
app.use(express.static(path.join(__dirname, "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
