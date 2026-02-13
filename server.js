const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

const moodGenres = {
  happy: [35, 10751, 12],
  sad: [18, 10749],
  romantic: [10749, 18],
  horror: [27],
  action: [28, 53],
  thriller: [53, 9648],
  adventure: [12, 14]
};

app.get("/", (req, res) => {
  res.send("MoodFlix AI Engine Running");
});

app.post("/recommend", async (req, res) => {
  const { query = "", language = "", type = "movie" } = req.body;

  try {
    // 1️⃣ Try smart search first
    if (query.trim()) {
      const searchRes = await axios.get(`${TMDB}/search/multi`, {
        params: {
          api_key: API_KEY,
          query,
          include_adult: false,
          page: 1
        }
      });

      let results = searchRes.data.results.filter(
        item =>
          item.media_type === type &&
          (language ? item.original_language === language : true)
      );

      if (results.length > 0) {
        return res.json({ results });
      }

      // 2️⃣ Fallback to mood-based genre
      const moodKey = query.toLowerCase();
      if (moodGenres[moodKey]) {
        const discoverRes = await axios.get(
          `${TMDB}/discover/${type}`,
          {
            params: {
              api_key: API_KEY,
              with_genres: moodGenres[moodKey].join(","),
              with_original_language: language || undefined,
              sort_by: "popularity.desc",
              vote_count_gte: 200,
              page: Math.floor(Math.random() * 10) + 1
            }
          }
        );
        return res.json({ results: discoverRes.data.results });
      }
    }

    // 3️⃣ Default fallback = trending
    const trendingRes = await axios.get(
      `${TMDB}/trending/${type}/week`,
      {
        params: { api_key: API_KEY }
      }
    );

    res.json({ results: trendingRes.data.results });

  } catch (err) {
    res.status(500).json({ error: "Recommendation failed" });
  }
});

app.get("/details/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  try {
    const details = await axios.get(`${TMDB}/${type}/${id}`, {
      params: {
        api_key: API_KEY,
        append_to_response: "videos"
      }
    });

    const providers = await axios.get(
      `${TMDB}/${type}/${id}/watch/providers`,
      { params: { api_key: API_KEY } }
    );

    const indiaProviders =
      providers.data.results?.IN?.flatrate || [];

    res.json({
      ...details.data,
      watchProviders: indiaProviders
    });

  } catch {
    res.status(500).json({ error: "Details failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`MoodFlix AI running on ${PORT}`)
);