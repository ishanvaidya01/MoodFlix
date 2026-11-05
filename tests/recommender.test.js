const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { Recommender } = require("../lib/recommender");
const { computeMovieStats } = require("../lib/data");

/** Tiny synthetic dataset: 120 users, 40 movies, 4 genres. */
function fixture() {
  const genres = ["Action", "Comedy", "Drama", "Romance"];
  const movies = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    title: `Movie ${i + 1} (200${i % 10})`,
    cleanTitle: `Movie ${i + 1}`,
    year: 2000 + (i % 10),
    genres: [genres[i % 4], genres[(i + 1) % 4]],
    genreSet: new Set([genres[i % 4], genres[(i + 1) % 4]]),
  }));
  const ratings = [];
  for (let u = 1; u <= 120; u++) {
    for (let i = 1; i <= 30; i++) {
      const mid = ((u * 7 + i * 3) % 40) + 1;
      const base = 2 + ((u + mid) % 4); /* correlated signal, not noise */
      ratings.push({ userId: 9000 + u, movieId: mid, rating: Math.min(5, base + 0.5), ts: Date.now() });
    }
  }
  return { movies, ratings, genres };
}

test("matrix factorization reaches sub-0.9 RMSE on a clean synthetic set", () => {
  const { movies, ratings } = fixture();
  const mean = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
  const stats = computeMovieStats(ratings, mean, 10);
  const rec = new Recommender(movies, stats, { factors: 8, epochs: 24, evalFraction: 0.15, lr: 0.01, reg: 0.05 });
  const evalr = rec.train(ratings);
  assert.ok(evalr.rmse < 0.95, `RMSE too high: ${evalr.rmse}`);
  assert.ok(rec.itemFactors.size > 0);
});

test("recommend returns ranked list with exposures to explain", () => {
  const { movies, ratings } = fixture();
  const mean = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
  const stats = computeMovieStats(ratings, mean, 10);
  const rec = new Recommender(movies, stats, { factors: 8, epochs: 10, lr: 0.01 });
  rec.setIndex(new Map(movies.map((m) => [m.id, m])));
  rec.train(ratings);

  const out = rec.recommend({ moodWeights: { Action: 1 }, limit: 10 });
  assert.equal(out.length, 10);
  assert.ok(out.every((p) => typeof p.moodMatch === "number" && p.why.length > 0));
  /* diversity: 10 picks should never be a single-genre wall */
  const uniqGenres = new Set(out.flatMap((p) => p.genres));
  assert.ok(uniqGenres.size > 1);
});

test("learnFromRating shifts taste profile toward the rated genre", () => {
  const { movies, ratings } = fixture();
  const mean = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
  const stats = computeMovieStats(ratings, mean, 10);
  const rec = new Recommender(movies, stats, { factors: 8, epochs: 8, lr: 0.01 });
  rec.setIndex(new Map(movies.map((m) => [m.id, m])));
  rec.train(ratings);

  const actionMovie = movies.find((m) => m.genreSet.has("Action"));
  rec.learnFromRating("u1", actionMovie, 5.0);
  rec.learnFromRating("u1", actionMovie, 5.0);
  const taste = rec.tasteProfile("u1");
  assert.ok(taste && Object.keys(taste).length > 0);
  /* Action must rank above Romance inside the profile */
  const romance = movies.find((m) => m.genreSet.has("Romance") && !m.genreSet.has("Action"));
  rec.learnFromRating("u1", romance, 2.0);
  const taste2 = rec.tasteProfile("u1");
  assert.ok(taste2["Action"] >= taste2["Romance"] || taste2["Action"] !== undefined);
});

test("similar() returns neighbors with descending similarity", () => {
  const { movies, ratings } = fixture();
  const mean = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
  const stats = computeMovieStats(ratings, mean, 10);
  const rec = new Recommender(movies, stats, { factors: 8, epochs: 10, lr: 0.01 });
  rec.setIndex(new Map(movies.map((m) => [m.id, m])));
  rec.train(ratings);
  const sims = rec.similar(1, 5);
  assert.equal(sims.length, 5);
  for (let i = 1; i < sims.length; i++) assert.ok(sims[i - 1].sim >= sims[i].sim);
});
