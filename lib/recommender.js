/**
 * lib/recommender.js — the local "MoodFlix ML" core. No network, no keys.
 *
 * Two cooperating models:
 *
 * 1. Global Matrix Factorization (FunkSVD) trained on real MovieLens ratings
 *    via plain SGD:
 *        r̂(u,i) = μ + b_u + b_i + p_u · q_i
 *    Held-out evaluation (RMSE, Precision@K) is computed in train() so the
 *    accuracy claim is measured, not asserted.
 *
 * 2. Per-user incremental taste learning: every rating a local user submits
 *    takes a handful of SGD steps on their own taste vector + bias, so the
 *    personalization is *live* — the model literally retrains as you rate.
 *
 * Scoring for a mood context blends four signals, all explainable:
 *      score = wT·taste + wM·mood + wQ·quality + wP·popularity_prior
 * then a diversity pass (genre-aware MMR) prevents same-genre walls.
 */

const fs = require("fs");
const path = require("path");

const MODEL_PATH = process.env.MOODFLIX_MODEL_PATH || path.join(__dirname, "..", "data", "model.json");

const DEFAULTS = {
  factors: 16,
  epochs: 14,
  lr: 0.008,
  reg: 0.06,
  evalFraction: 0.1,
  seed: 42,
  /* scoring blend */
  wTaste: 0.55,
  wMood: 0.8,
  wQuality: 1.0,
  wPop: 0.15,
  diversityLambda: 0.6,
};

/* deterministic RNG so results are reproducible */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 62 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** cosine similarity between two sparse genre sets (for explanations) */
function genreOverlap(genreSetA, genreSetB) {
  if (!genreSetA || !genreSetB || genreSetA.size === 0) return 0;
  let inter = 0;
  for (const g of genreSetB) if (genreSetA.has(g)) inter++;
  return genreSetB.size === 0 ? 0 : inter / genreSetB.size;
}

class Recommender {
  /**
   * @param {Array} movies  dataset movie records (from lib/data.loadDataset)
   * @param {Object} stats  Map movieId -> { bayes, n } (from computeMovieStats)
   * @param {Object} opts   overrides of DEFAULTS
   */
  constructor(movies, stats, opts = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.movies = movies;
    this.stats = stats;
    this.globalMean = null;
    this.userFactors = new Map();  /* dataset user id -> Float64Array */
    this.itemFactors = new Map();  /* movie id -> Float64Array */
    this.userBias = new Map();
    this.itemBias = new Map();
    this.eval = null;              /* held-out metrics from train() */
    this.customUsers = new Map();  /* local user (三位数 id from app) -> {factors,bias} */
  }

  /* ---------------- training ---------------- */

  /**
   * Train the global MF on MovieLens ratings with a held-out split.
   * @param {Array} ratings [{userId, movieId, rating}]
   * @returns {{rmse:number, mae:number, precisionAt10:number, nEval:number}}
   */
  train(ratings) {
    const { factors, epochs, lr, reg, evalFraction, seed } = this.opts;
    const rng = mulberry32(seed);

    /* deterministic shuffle + split */
    const shuffled = ratings.filter((r) => this.stats.has(r.movieId));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const nEval = Math.floor(shuffled.length * evalFraction);
    const evalSet = shuffled.slice(0, nEval);
    const trainSet = shuffled.slice(nEval);

    this.globalMean = trainSet.reduce((s, r) => s + r.rating, 0) / Math.max(1, trainSet.length);

    this.userFactors = new Map();
    this.itemFactors = new Map();
    this.userBias = new Map();
    this.itemBias = new Map();

    const userSeen = new Map(); /* userId -> count (for pretraining bias) */
    for (const r of trainSet) {
      if (!this.userFactors.has(r.userId)) {
        this.userFactors.set(r.userId, Float64Array.from({ length: factors }, () => (rng() - 0.5) * 0.1));
        this.userBias.set(r.userId, 0);
      }
      if (!this.itemFactors.has(r.movieId)) {
        this.itemFactors.set(r.movieId, Float64Array.from({ length: factors }, () => (rng() - 0.5) * 0.1));
        this.itemBias.set(r.movieId, 0);
      }
      userSeen.set(r.userId, (userSeen.get(r.userId) || 0) + 1);
    }

    /* predict + one SGD step; classic FunkSVD loop */
    const predict = (u, i) =>
      this.globalMean + (this.userBias.get(u) || 0) + (this.itemBias.get(i) || 0) + dot(this.userFactors.get(u), this.itemFactors.get(i));

    const step = (r) => {
      const pu = this.userFactors.get(r.userId);
      const qi = this.itemFactors.get(r.movieId);
      const bu = this.userBias.get(r.userId);
      const bi = this.itemBias.get(r.movieId);
      if (!pu || !qi) return;
      const err = r.rating - (this.globalMean + bu + bi + dot(pu, qi));
      /* bias updates */
      this.userBias.set(r.userId, bu + lr * (err - reg * bu));
      this.itemBias.set(r.movieId, bi + lr * (err - reg * bi));
      /* factor updates */
      for (let k = 0; k < factors; k++) {
        const pk = pu[k], qk = qi[k];
        pu[k] = pk + lr * (err * qk - reg * pk);
        qi[k] = qk + lr * (err * pk - reg * qk);
      }
    };

    for (let e = 0; e < epochs; e++) {
      for (const r of trainSet) step(r);
    }

    /* ---- held-out evaluation ---- */
    let se = 0, ae = 0;
    for (const r of evalSet) {
      const p = predict(r.userId, r.movieId);
      se += (p - r.rating) ** 2;
      ae += Math.abs(p - r.rating);
    }
    const rmse = evalSet.length ? Math.sqrt(se / evalSet.length) : 0;
    const mae = evalSet.length ? ae / evalSet.length : 0;

    /* precision@10 per eval user with >=10 eval ratings */
    const byUser = new Map();
    for (const r of evalSet) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, []);
      byUser.get(r.userId).push(r);
    }
    let pSum = 0, pUsers = 0;
    for (const [uid, rows] of byUser) {
      if (rows.length < 10) continue;
      const ranked = rows
        .map((r) => ({ ...r, p: predict(uid, r.movieId) }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 10);
      const hits = ranked.filter((r) => r.rating >= 4.0).length;
      pSum += hits / 10;
      pUsers++;
    }
    const precisionAt10 = pUsers ? pSum / pUsers : 0;

    this.eval = { rmse, mae, precisionAt10, nEval: evalSet.length, nTrain: trainSet.length, factors, epochs };

    /* remember dataset users for future reference */
    for (const uid of this.userFactors.keys()) {
      if (!this.customUsers.has(uid)) this.customUsers.set(uid, { local: false });
    }
    return this.eval;
  }

  persist() {
    try {
      const payload = {
        globalMean: this.globalMean,
        opts: this.opts,
        eval: this.eval,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(MODEL_PATH, JSON.stringify(payload));
    } catch (_) { /* non-fatal: model retrains on boot */ }
  }

  /* ---------------- per-user learning ---------------- */

  /** Local (app-level) user vector, created on first rating. */
  ensureLocalUser(userId) {
    if (!this.customUsers.has(userId)) {
      const rng = mulberry32(Date.now() ^ userId);
      this.customUsers.set(userId, {
        local: true,
        factors: Float64Array.from({ length: this.opts.factors }, () => (rng() - 0.5) * 0.05),
        bias: 0,
      });
    }
    return this.customUsers.get(userId);
  }

  /**
   * Incremental SGD update of a local user's taste vector from a rating.
   * @returns {{ taste: Object.<genre,number>, ratingsCount:number }} raw influence
   */
  learnFromRating(userId, movie, rating) {
    const u = this.ensureLocalUser(userId);
    const q = this.itemFactors.get(movie.id) || Float64Array.from({ length: this.opts.factors }, () => 0);
    const bi = this.itemBias.get(movie.id) || 0;
    const err = rating - (this.globalMean + u.bias + bi + dot(u.factors, q));
    const { lr, reg } = this.opts;
    u.bias += lr * (err - reg * u.bias);
    for (let k = 0; k < this.opts.factors; k++) u.factors[k] += lr * (err * q[k] - reg * u.factors[k]);
    return this.tasteProfile(userId);
  }

  /**
   * Human-readable taste profile of a user: strongest liked genres (from
   * their item-factor alignment), returned as genre -> affinity 0..1.
   */
  tasteProfile(userId) {
    const u = this.customUsers.get(userId);
    if (!u) return null;
    const scores = new Map();
    for (const m of this.movies) {
      const q = this.itemFactors.get(m.id);
      const b = this.itemBias.get(m.id) || 0;
      if (!q) continue;
      scores.set(m.id, dot(u.factors, q) + b);
    }
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
    const tally = new Map();
    for (const [movieId, s] of ranked) {
      const movie = this._byId && this._byId.get(movieId);
      if (!movie) continue;
      for (const g of movie.genreSet) tally.set(g, (tally.get(g) || 0) + s);
    }
    const out = Object.create(null);
    let max = Math.max(1e-6, ...tally.values());
    for (const [g, s] of tally) out[g] = Math.max(0, Math.min(1, (s + max) / (2 * max)));
    return out;
  }

  /* ---------------- scoring & ranking ---------------- */

  /**
   * Rank the catalog for (user profile? + mood?).
   * @returns RecommendResult[] sorted + diversity-reranked
   */
  recommend({ moodWeights = {}, userId = null, limit = 30, exclude = new Set() } = {}) {
    const { wTaste, wMood, wQuality, wPop, diversityLambda } = this.opts;
    const taste = userId ? this.customUsers.get(userId) : null;
    const tasteProfile = userId ? this.tasteProfile(userId) || {} : {};
    const hasTaste = Object.keys(tasteProfile).length > 0;
    const moodKeys = Object.keys(moodWeights);

    /* mood target vector shared by all candidates */
    const moodScore = (movie) => {
      if (moodKeys.length === 0) return 0.5;
      let s = 0;
      for (const g of movie.genreSet) s += moodWeights[g] || 0;
      return s / Math.max(1, moodKeys.length);
    };
    const tasteScore = (movie) => {
      if (!hasTaste) return 0.5;
      let s = 0;
      for (const g of movie.genreSet) s += tasteProfile[g] || 0.5;
      return s / Math.max(1, movie.genreSet.size);
    };
    /* item-factor affinity with the user's own vector (learned, sparse-ish) */
    const personalScore = (movie) => {
      if (!taste || taste.local !== true) return 0.5;
      const q = this.itemFactors.get(movie.id);
      if (!q) return 0.5;
      return Math.max(0, Math.min(1, 0.5 + dot(taste.factors, q) * 0.25));
    };

    const popDenom = Math.log(2e4);
    const candidates = [];
    for (const m of this.movies) {
      if (exclude.has(m.id)) continue;
      if (m.genreSet.size === 0) continue;
      const st = this.stats.get(m.id);
      const quality = st ? Math.max(0, Math.min(1, (st.bayes - 2.5) / 2.5)) : 0.5;
      const pop = Math.max(0, Math.min(1, Math.log((st?.n || 1) + 1) / popDenom));
      const score =
        wTaste * (0.5 * tasteScore(m) + 0.5 * personalScore(m)) +
        wMood * moodScore(m) +
        wQuality * quality +
        wPop * pop +
        (hasTaste ? 0.15 * (this.itemAffinity(m.id, userId) || 0.5) : 0);
      candidates.push({ movie: m, score, moodS: moodScore(m), tasteS: tasteScore(m), quality, pop, nRatings: st?.n || 0, bayes: st?.bayes });
    }

    candidates.sort((a, b) => b.score - a.score);

    /* genre-aware MMR diversification */
    const picked = [];
    const usedGenres = new Map();
    for (const c of candidates) {
      if (picked.length >= limit) break;
      let penalty = 0;
      for (const g of c.movie.genreSet) {
        penalty += diversityLambda * ((usedGenres.get(g) || 0) / (picked.length + 1));
      }
      c.adjusted = c.score - penalty;
      picked.push(c);
      for (const g of c.movie.genreSet) usedGenres.set(g, (usedGenres.get(g) || 0) + 1);
    }

    /* final order by adjusted score */
    picked.sort((a, b) => b.adjusted - a.adjusted);
    return picked.slice(0, limit).map((c) => ({
      id: c.movie.id,
      title: c.movie.cleanTitle,
      year: c.movie.year,
      genres: c.movie.genres,
      bayes: c.bayes ? round2(c.bayes) : null,
      nRatings: c.nRatings,
      moodMatch: round2(c.moodS),
      tasteMatch: round2(c.tasteS),
      quality: round2(c.quality),
      score: round2(c.adjusted),
      why:
        moodKeys.length === 0
          ? hasTaste ? [`${pct(c.tasteS)} match with films you rated highly`, `${pct(c.quality)} community quality`] : [`${pct(c.quality)} community quality`, "crowd favorite"]
          : [
              `${pct(c.moodS)} mood match`,
              ...(hasTaste ? [`${pct(c.tasteS)} match with your taste profile`] : []),
              `${pct(c.quality)} community quality`,
            ],
    }));
  }

  itemAffinity(movieId, userId) {
    const u = userId && this.customUsers.get(userId);
    if (!u || u.local !== true) return null;
    const q = this.itemFactors.get(movieId);
    if (!q) return null;
    return Math.max(0, Math.min(1, 0.5 + dot(u.factors, q) * 0.25));
  }

  /** similar movies by learned item-vector cosine (fallback: genre overlap) */
  similar(movieId, limit = 12) {
    const q = this.itemFactors.get(movieId);
    const movie = this._byId.get(movieId);
    if (!movie) return [];
    const sims = [];
    for (const m of this.movies) {
      if (m.id === movieId || m.genreSet.size === 0) continue;
      const st = this.stats.get(m.id) || { bayes: this.globalMean, n: 0 };
      let sim;
      if (q) {
        const q2 = this.itemFactors.get(m.id);
        sim = q2 ? dot(q, q2) / (norm(q) * norm(q2) + 1e-9) : 0;
        sim = Math.max(0, sim);
      } else {
        sim = genreOverlap(movie.genreSet, m.genreSet);
      }
      sims.push({ movie: m, sim, bayes: st.bayes, n: st.n });
    }
    sims.sort((a, b) => b.sim - a.sim || b.bayes - a.bayes);
    return sims.slice(0, limit).map((s) => ({
      id: s.movie.id,
      title: s.movie.cleanTitle,
      year: s.movie.year,
      genres: s.movie.genres,
      bayes: round2(s.bayes),
      nRatings: s.n,
      sim: round2(Math.min(1, s.sim)),
    }));
  }

  setIndex(moviesById) {
    this._byId = moviesById;
  }
}

/* ---------- small numeric helpers ---------- */

function dot(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k] * b[k];
  return s;
}
function norm(a) {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k] * a[k];
  return Math.sqrt(s);
}
function round2(x) {
  return x == null ? null : Number(Number(x).toFixed(2));
}
function pct(x) {
  return Math.round((x || 0) * 100) + "%";
}

module.exports = { Recommender, DEFAULTS, genreOverlap, mulberry32 };
