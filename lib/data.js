/**
 * lib/data.js — MovieLens dataset loading and per-film derived stats.
 *
 * Dataset (auto-downloaded by scripts/prepare-data.js):
 *   data/ml-latest-small/movies.csv   movieId,title(year),genres(pipe separated)
 *   data/ml-latest-small/ratings.csv  userId,movieId,rating,timestamp
 *   data/ml-latest-small/links.csv    movieId,imdbId,tmdbId
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.MOODFLIX_DATA_DIR || path.join(__dirname, "..", "data", "ml-latest-small");

function movieCsvPath() {
  return path.join(DATA_DIR, "movies.csv");
}
function ratingsCsvPath() {
  return path.join(DATA_DIR, "ratings.csv");
}
function linksCsvPath() {
  return path.join(DATA_DIR, "links.csv");
}

function datasetPresent() {
  return fs.existsSync(movieCsvPath()) && fs.existsSync(ratingsCsvPath());
}

/** Parse one CSV line respecting double quotes. Returns array of fields. */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Extract `year` from "Title (1995)" or "Title (1995)"-style titles. */
function extractYear(title) {
  const m = /\((\d{4})\)\s*$/.exec(title || "");
  if (m) return parseInt(m[1], 10);
  const any = /\b(19\d{2}|20[0-2]\d)\b/.exec(title || "");
  return any ? parseInt(any[1], 10) : null;
}

/** Strip "(1995)" suffix and clean titles. */
function cleanTitle(title) {
  return (title || "").replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

/**
 * Load the full dataset.
 * @returns {{ movies: MovieRecord[], ratings: RatingRow[], links: Map<number,string> }}
 *   MovieRecord: { id, title, cleanTitle, year, genres: string[], genreSet:Set }
 *   RatingRow:  { userId, movieId, rating, ts }
 */
function loadDataset() {
  if (!datasetPresent()) {
    const e = new Error("Dataset missing. Run: npm run data:prepare");
    e.status = 503;
    throw e;
  }

  const movies = fs.readFileSync(movieCsvPath(), "utf8").split(/\r?\n/);
  const ratingsRaw = fs.readFileSync(ratingsCsvPath(), "utf8").split(/\r?\n/);

  const headers = movies.shift();
  const ratingsHeader = ratingsRaw.shift();

  const movieIndex = new Map();
  for (const line of movies) {
    if (!line) continue;
    const [id, title, genres] = parseCsvLine(line);
    if (!id || !title) continue;
    const genreList = (genres || "").split("|").filter((g) => g && g !== "(no genres listed)");
    const rec = {
      id: parseInt(id, 10),
      title,
      cleanTitle: cleanTitle(title),
      year: extractYear(title),
      genres: genreList,
      genreSet: new Set(genreList),
    };
    movieIndex.set(rec.id, rec);
  }

  const ratings = [];
  for (const line of ratingsRaw) {
    if (!line) continue;
    const [userId, movieId, rating, ts] = line.split(",");
    const r = parseFloat(rating);
    if (!movieIndex.has(parseInt(movieId, 10))) continue;
    ratings.push({
      userId: parseInt(userId, 10),
      movieId: parseInt(movieId, 10),
      rating: r,
      ts: parseInt(ts, 10),
    });
  }

  const links = new Map();
  if (fs.existsSync(linksCsvPath())) {
    const linkLines = fs.readFileSync(linksCsvPath(), "utf8").split(/\r?\n/);
    linkLines.shift();
    for (const line of linkLines) {
      if (!line) continue;
      const [mid, imdbId] = line.split(",");
      if (mid && imdbId && imdbId !== "tt0") links.set(parseInt(mid, 10), "tt" + String(imdbId).padStart(7, "0"));
    }
  }

  return { movies: [...movieIndex.values()], ratings, links, headers, ratingsHeader };
}

/**
 * Compute per-movie Bayesian平滑 average rating + popularity.
 * m_i = (C * globalMean + sumRatings_i) / (C + n_i)
 */
function computeMovieStats(ratings, globalMean, priorWeight = 25) {
  const sums = new Map();
  for (const r of ratings) {
    const s = sums.get(r.movieId) || { sum: 0, n: 0 };
    s.sum += r.rating;
    s.n += 1;
    sums.set(r.movieId, s);
  }
  const stats = new Map();
  for (const [movieId, { sum, n }] of sums) {
    const bayes = (priorWeight * globalMean + sum) / (priorWeight + n);
    stats.set(movieId, { bayes, n, sum });
  }
  return stats;
}

module.exports = {
  DATA_DIR,
  datasetPresent,
  loadDataset,
  computeMovieStats,
  parseCsvLine,
  extractYear,
  cleanTitle,
  movieCsvPath,
  ratingsCsvPath,
};
