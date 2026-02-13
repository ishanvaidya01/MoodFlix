const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

/* TRENDING */
app.get("/trending", async (req, res) => {
  const response = await axios.get(`${TMDB}/trending/movie/week`, {
    params: { api_key: API_KEY }
  });

  res.json(response.data.results);
});

/* TOP RATED */
app.get("/top-rated", async (req, res) => {
  const response = await axios.get(`${TMDB}/movie/top_rated`, {
    params: { api_key: API_KEY }
  });

  res.json(response.data.results);
});

/* SEARCH (GENRE + TEXT BASED) */
app.post("/search", async (req, res) => {
  const { query = "", page = 1 } = req.body;

  try {
    if (!query.trim()) {
      return res.json({ results: [] });
    }

    const response = await axios.get(`${TMDB}/search/movie`, {
      params: {
        api_key: API_KEY,
        query,
        include_adult: false,
        page
      }
    });

    const results = response.data.results
      .filter(m => m.poster_path && m.vote_count > 20)
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 60);

    res.json(results);

  } catch {
    res.status(500).json({ error: "Search failed" });
  }
});

/* FULL MOVIE DETAILS */
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
    res.status(500).json({ error: "Details fetch failed" });
  }
});

app.listen(process.env.PORT || 5000);