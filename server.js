/**
 * server.js — MoodFlix API (100% local/offline).
 *
 * A mood-aware movie recommender powered by a Matrix Factorization model
 * trained on MovieLens ratings. No external API keys, no cloud calls:
 *
 *   GET  /api/health               liveness + model/dataset status
 *   GET  /api/model                held-out evaluation metrics (RMSE, P@10)
 *   POST /api/search               { query }  mood-aware ranking
 *   GET  /api/recommend            cold-start picks (no query needed)
 *   GET  /api/movie/:id            details + similar + IMDb link
 *   GET  /api/moods                available mood shortcuts (UI chips)
 *   GET  /api/favorites            list favorites
 *   POST /api/favorites            { title, ... } add favorite
 *   DEL  /api/favorites/:id        remove favorite
 *   POST /api/rate                 { movieId, rating } — retrains your taste vector live
 *   GET  /api/profile              your learned taste profile (genre affinities)
 */

require("dotenv").config();
const path = require("path");

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const sqlite3 = require("sqlite3").verbose();

const { analyzeMood, MOOD_GROUPS } = require("./lib/mood");
const data = require("./lib/data");
const { Recommender } = require("./lib/recommender");
const { computeMovieStats } = require("./lib/data");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;
const RATE = { windowMs: 60_000, max: parseInt(process.env.RATE_LIMIT || "120", 10) };
const FAVORITES_DB = process.env.MOODFLIX_DB || path.join(__dirname, "favorites.db");

app.use(helmet());
app.use(compression());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

/* ================================================================
   DATASET + MODEL BOOTSTRAP
================================================================ */

let recommender = null;
let moviesById = null;
let linksById = null;
let bootError = null;

function bootstrap() {
  try {
    const { movies, ratings, links } = data.loadDataset();
    const globalMean = ratings.reduce((s, r) => s + r.rating, 0) / Math.max(1, ratings.length);
    const stats = computeMovieStats(ratings, globalMean);

    recommender = new Recommender(movies, stats, {
      factors: parseInt(process.env.MF_FACTORS || "16", 10),
      epochs: parseInt(process.env.MF_EPOCHS || "14", 10),
    });
    recommender.setIndex(new Map(movies.map((m) => [m.id, m])));
    recommender.train(ratings);
    recommender.persist();

    moviesById = new Map(movies.map((m) => [m.id, m]));
    linksById = links;

    const t0 = Date.now();
    console.log(
      `dataset: ${movies.length} movies / ${ratings.length} ratings — trained in ${Date.now() - t0}ms ` +
      `(RMSE ${recommender.eval.rmse.toFixed(3)}, P@10 ${(recommender.eval.precisionAt10 * 100).toFixed(1)}%)`
    );
  } catch (err) {
    bootError = err.message;
    console.error("Bootstrap failed:", err.message);
  }
}

/* ================================================================
   RATE LIMITING (fixed window, per IP)
================================================================ */

const hits = new Map();

app.use((req, res, next) => {
  if (bootError && req.path !== "/api/health") {
    return res.status(503).json({ error: bootError, hint: "Run: npm run data:prepare" });
  }
  if (!recommender && req.path !== "/api/health") {
    return res.status(503).json({ error: "Model is still loading. Try again in a second." });
  }
  const ip = req.ip || "unknown";
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  if (list.length >= RATE.max) {
    res.set("Retry-After", Math.ceil((RATE.windowMs - (now - list[0])) / 1000));
    return res.status(429).json({ error: "Too many requests — slow down a touch." });
  }
  list.push(now);
  hits.set(ip, list);
  next();
});

/* ================================================================
   FAVORITES (SQLite) — as before
================================================================ */

const favoritesDb = new sqlite3.Database(FAVORITES_DB);
favoritesDb.serialize(() => {
  favoritesDb.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    poster TEXT,
    rating REAL,
    language TEXT,
    created_at TEXT
  )`);
  favoritesDb.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_favorites_title ON favorites(title, language)`);
  /* migrate older schema files that pre-date created_at (SQLite forbids
     ADD COLUMN with a non-constant default, so it's a plain TEXT column
     and the app stamps it on insert) */
  favoritesDb.all("PRAGMA table_info(favorites)", (err, cols) => {
    if (err || !cols) return;
    if (!cols.some((c) => c.name === "created_at")) {
      favoritesDb.run(`ALTER TABLE favorites ADD COLUMN created_at TEXT`, () => {});
    }
  });
});

function favQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    favoritesDb.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}
function favRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    favoritesDb.run(sql, params, function (err) {
      return err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/* ================================================================
   ROUTES
================================================================ */

app.get("/api/health", (req, res) => {
  res.json({
    status: bootError ? "degraded" : "ok",
    uptime: Math.round(process.uptime()),
    dataset: {
      present: data.datasetPresent(),
      dir: data.DATA_DIR,
    },
    model: recommender ? { ready: true, rmse: recommender.eval?.rmse, trainedAt: recommender.eval?.trainedAt } : { ready: false },
  });
});

app.get("/api/model", (req, res) => {
  if (!recommender) return res.status(503).json({ error: bootError || "model loading" });
  res.json({
    approach: "Matrix factorization (FunkSVD) trained on MovieLens ratings",
    hyperparameters: { factors: recommender.eval.factors, epochs: recommender.eval.epochs, reg: recommender.opts.reg, lr: recommender.opts.lr },
    evaluation: recommender.eval,
    interpret:
      "RMSE is measured on a held-out 10% of ratings this process never trained on. P@10 = fraction of a rater's top-10 predictions they actually rated >= 4 stars.",
  });
});

app.get("/api/moods", (req, res) => {
  res.json(
    MOOD_GROUPS.map((g) => ({
      id: g.id,
      label: g.id.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      sample: g.phrases[Math.floor(Math.min(g.phrases.length - 1, Date.now() / 86400000) % g.phrases.length)],
      genres: g.genres,
    }))
  );
});

/* Local demo user: cookies not needed; a header/param identifies the rater */
function currentUserId(req) {
  return String(req.query.userId || req.body?.userId || "local-user");
}

app.post("/api/search", async (req, res) => {
  const { query = "", limit = 30 } = req.body || {};
  if (!String(query).trim()) return res.status(400).json({ error: "Tell me how you're feeling." });
  if (String(query).length > 280) return res.status(400).json({ error: "Keep it under 280 characters." });

  const { moods, genreWeights, matchedPhrases } = analyzeMood(query);
  const userId = currentUserId(req);

  /* learned taste + current mood both shape the ranking */
  let finalWeights = { ...genreWeights };
  const profile = recommender.tasteProfile(userId);
  if (profile && Object.keys(profile).length > 0) {
    for (const [g, w] of Object.entries(profile)) {
      finalWeights[g] = (finalWeights[g] || 0) * 0.6 + w * 0.4;
    }
  }

  const exclude = new Set();
  const seen = new Set(
    (await favQuery("SELECT title FROM favorites")).map((f) => f.title.toLowerCase())
  );

  const picks = recommender.recommend({
    moodWeights: finalWeights,
    userId,
    limit: Math.min(60, Math.max(5, parseInt(limit, 10) || 30)),
    exclude,
  });
  for (const p of picks) p.favorite = seen.has(String(p.title).toLowerCase());

  res.json({
    moods: moods.length ? moods : ["surprise-me"],
    matchedPhrases,
    results: picks,
  });
});

app.get("/api/recommend", async (req, res) => {
  const userId = currentUserId(req);
  const picks = recommender.recommend({
    moodWeights: {},
    userId,
    limit: Math.min(60, Math.max(5, parseInt(req.query.limit, 10) || 30)),
  });
  const seen = new Set((await favQuery("SELECT title FROM favorites")).map((f) => f.title.toLowerCase()));
  for (const p of picks) p.favorite = seen.has(String(p.title).toLowerCase());
  res.json({ moods: [], matchedPhrases: [], results: picks });
});

app.get("/api/movie/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const movie = moviesById.get(id);
  if (!movie) return res.status(404).json({ error: "Movie not found." });

  const st = recommender._stats ? recommender._stats.get(id) : null;
  const imdbId = linksById ? linksById.get(id) : null;
  res.json({
    id: movie.id,
    title: movie.cleanTitle,
    year: movie.year,
    genres: movie.genres,
    imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}/` : null,
    neighbors: recommender.similar(id, 12).filter((m) => m.id !== id),
  });
});

app.post("/api/rate", async (req, res) => {
  const { movieId, rating } = req.body || {};
  const movie = moviesById.get(parseInt(movieId, 10));
  const r = parseFloat(rating);
  if (!movie) return res.status(404).json({ error: "Unknown movie." });
  if (!(r >= 0.5 && r <= 5)) return res.status(400).json({ error: "Rating must be 0.5–5." });

  const userId = currentUserId(req);
  const taste = recommender.learnFromRating(userId, movie, r);
  res.json({ ok: true, movieId: movie.id, rated: r, taste });
});

app.get("/api/profile", (req, res) => {
  const userId = currentUserId(req);
  const taste = recommender.tasteProfile(userId);
  if (!taste || Object.keys(taste).length === 0) {
    return res.json({ trained: false, message: "Rate a few movies and your taste profile will appear here." });
  }
  const top = Object.entries(taste)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([genre, w]) => ({ genre, affinity: Number(w.toFixed(2)) }));
  res.json({ trained: true, top });
});

app.get("/api/favorites", async (req, res) => {
  try {
    res.json(await favQuery("SELECT * FROM favorites ORDER BY created_at DESC"));
  } catch {
    res.status(500).json({ error: "Could not load favorites." });
  }
});

app.post("/api/favorites", async (req, res) => {
  const { title, poster, rating, language, id } = req.body || {};
  if (!title || typeof title !== "string") return res.status(400).json({ error: "A title is required." });
  try {
    const existing = await favQuery("SELECT id FROM favorites WHERE title=? AND language=?", [title, language || "en"]);
    if (existing.length > 0) return res.status(409).json({ error: "Already in favorites.", id: existing[0].id });
    const r = await favRun(
      "INSERT INTO favorites (id, title, poster, rating, language, created_at) VALUES (?,?,?,?,?,?)",
      [id || Date.now(), title.trim(), poster || null, rating || null, language || "en", new Date().toISOString()]
    );
    res.status(201).json({ ok: true, id: r.lastID });
  } catch {
    res.status(500).json({ error: "Could not save favorite." });
  }
});

app.delete("/api/favorites/:id", async (req, res) => {
  try {
    const r = await favRun("DELETE FROM favorites WHERE id=?", [req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: "Favorite not found." });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not remove favorite." });
  }
});

/* 404 + error handling */
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => { /* eslint-disable-line no-unused-vars */
  console.error(err.message);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  res.status(err.status || err.statusCode || 500).json({ error: "Something went wrong." });
});

/* Start only when run directly */
if (require.main === module) {
  bootstrap();
  app.listen(PORT, () => console.log(`MoodFlix (offline ML) up on :${PORT}`));
}

module.exports = { app, bootstrap, _internals: { get recommender() { return recommender; }, get moviesById() { return moviesById; } } };
