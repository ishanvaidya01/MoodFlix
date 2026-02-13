const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const TMDB = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_KEY;

/* Helper: Fetch Multiple Pages */
async function fetchMultiplePages(url, params, pages = 3) {
  let allResults = [];

  for (let i = 1; i <= pages; i++) {
    const res = await axios.get(url, {
      params: { ...params, page: i }
    });
    allResults = [...allResults, ...res.data.results];
  }

  return allResults;
}

/* Get Genre List */
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

/* TRENDING */
app.get("/trending", async (req, res) => {
  const results = await fetchMultiplePages(
    `${TMDB}/trending/movie/week`,
    { api_key: API_KEY },
    4
  );

  res.json(results);
});

/* TOP RATED */
app.get("/top-rated", async (req, res) => {
  const results = await fetchMultiplePages(
    `${TMDB}/movie/top_rated`,
    { api_key: API_KEY },
    4
  );

  res.json(results);
});

/* SEARCH */
app.post("/search", async (req, res) => {
  const { query = "" } = req.body;

  if (!query.trim()) {
    return res.json([]);
  }

  try {
    const lowerQuery = query.toLowerCase();

    let results = [];

    /* If query matches a genre */
    if (genreMap[lowerQuery]) {
      results = await fetchMultiplePages(
        `${TMDB}/discover/movie`,
        {
          api_key: API_KEY,
          with_genres: genreMap[lowerQuery],
          sort_by: "vote_average.desc",
          "vote_count.gte": 100
        },
        5
      );
    } else {
      /* Normal Search */
      results = await fetchMultiplePages(
        `${TMDB}/search/movie`,
        {
          api_key: API_KEY,
          query,
          include_adult: false
        },
        4
      );

      /* Sort better movies first */
      results.sort((a, b) => {
        const scoreA = a.vote_average * Math.log(a.vote_count + 1);
        const scoreB = b.vote_average * Math.log(b.vote_count + 1);
        return scoreB - scoreA;
      });
    }

    const cleaned = results
      .filter(m => m.poster_path)
      .slice(0, 150);

    res.json(cleaned);

  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

/* MOVIE DETAILS */
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