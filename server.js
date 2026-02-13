const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

/* SEARCH */

app.post("/recommend", async (req, res) => {
  const { query = "", page = 1 } = req.body;

  try {
    if (!query.trim()) {
      return res.json({ results: [], total_pages: 1 });
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
      .filter(m => m.poster_path && m.vote_count > 50)
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 36);

    res.json({
      results,
      total_pages: response.data.total_pages
    });

  } catch (err) {
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